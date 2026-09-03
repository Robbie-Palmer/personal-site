import {
  type Account,
  type AssetType,
  type Currency,
  type ExpectedReturnChange,
  isLiability,
} from "./account";
import {
  buildBalanceEstimateSeries,
  computeMoneyWeightedReturn,
  type ExternalFlow,
} from "./assetTrackerAnalytics";
import type { BalanceSnapshot } from "./balanceSnapshot";
import type { CapitalFlow, CapitalFlowKind } from "./capitalFlow";
import type { Transfer } from "./transfer";

function compareIsoDates(a: string, b: string): number {
  // BalanceSnapshotSchema guarantees canonical YYYY-MM-DD strings, for which
  // code-unit order is chronological and avoids timezone-dependent parsing.
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Mortgages secured on a property are netted into that property so a home
 * shows as equity, not gross value, in totals and charts. Returns the set of
 * absorbed (linked-mortgage) account IDs and, per property, its mortgages.
 */
export function buildLinkage(accounts: Account[]): {
  absorbedIds: Set<string>;
  mortgagesByProperty: Map<string, string[]>;
} {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const absorbedIds = new Set<string>();
  const mortgagesByProperty = new Map<string, string[]>();
  for (const account of accounts) {
    if (account.assetType !== "mortgage" || account.linkedAccountId == null) {
      continue;
    }
    const property = byId.get(account.linkedAccountId);
    if (property?.assetType !== "property") continue;
    absorbedIds.add(account.id);
    const existing = mortgagesByProperty.get(property.id) ?? [];
    existing.push(account.id);
    mortgagesByProperty.set(property.id, existing);
  }
  return { absorbedIds, mortgagesByProperty };
}

export type AccountSummaryView = {
  id: string;
  name: string;
  provider: string;
  currency: Currency;
  assetType: AssetType;
  expectedAnnualReturn: number;
  isOpen: boolean;
  latestBalance: number | null;
  latestSnapshotDate: string | null;
  /**
   * Realised annual growth rate, excluding recorded transfers in/out so
   * contributions don't count as growth; null for closed accounts or
   * sparse data
   */
  cagr: number | null;
};

export type BalanceSnapshotView = {
  date: string;
  balance: number;
};

export type AccountDetailView = AccountSummaryView & {
  createdAt: string;
  closedAt?: string;
  expectedReturnChanges?: ExpectedReturnChange[];
  linkedAccountId?: string;
  snapshots: BalanceSnapshotView[];
  capitalFlows: { date: string; amount: number; kind?: CapitalFlowKind }[];
  /** Deposits minus withdrawals recorded across the account history */
  netContributed: number | null;
  /** Current market value minus net contributed capital */
  gainLoss: number | null;
};

export type NetWorthDataPoint = {
  date: string;
  total: number;
  /** Net worth with unvalued investments replaced by expected balances. */
  estimatedTotal?: number;
  [accountName: string]: string | number | undefined;
};

export type EquitySummary = {
  propertyName: string;
  value: number;
};

/**
 * Home equity from the account's perspective: for a property, its value plus
 * the (negative) balances of open mortgages secured on it; for a mortgage,
 * the linked property's value plus this balance. Null when nothing is linked.
 */
export function computeEquitySummary(
  account: AccountDetailView,
  allAccounts: AccountDetailView[],
): EquitySummary | null {
  if (account.assetType === "property") {
    const mortgages = allAccounts.filter(
      (a) => a.linkedAccountId === account.id && a.isOpen,
    );
    if (mortgages.length === 0) return null;
    const mortgageTotal = mortgages.reduce(
      (sum, mortgage) => sum + (mortgage.latestBalance ?? 0),
      0,
    );
    return {
      propertyName: account.name,
      value: (account.latestBalance ?? 0) + mortgageTotal,
    };
  }
  if (account.linkedAccountId == null) return null;
  const property = allAccounts.find((a) => a.id === account.linkedAccountId);
  if (!property) return null;
  return {
    propertyName: property.name,
    value: (property.latestBalance ?? 0) + (account.latestBalance ?? 0),
  };
}

/**
 * Selects recorded capital history when present, otherwise deriving signed
 * external flows from transfers into and out of the account.
 */
export function selectAccountExternalFlows(
  accountId: string,
  transfers: Transfer[],
  recordedCapital: ExternalFlow[],
): ExternalFlow[] {
  // Pasted capital history is authoritative when present. Falling back keeps
  // existing transfer-driven accounts compatible without double counting.
  if (recordedCapital.length > 0) return recordedCapital;
  const flows: ExternalFlow[] = [];
  for (const transfer of transfers) {
    if (transfer.toAccountId === accountId) {
      flows.push({ date: transfer.date, amount: transfer.amount });
    } else if (transfer.fromAccountId === accountId) {
      flows.push({ date: transfer.date, amount: -transfer.amount });
    }
  }
  return flows;
}

function toExternalFlows(
  accountId: string,
  transfers: Transfer[],
  capitalFlows: CapitalFlow[],
): ExternalFlow[] {
  return selectAccountExternalFlows(
    accountId,
    transfers,
    capitalFlows
      .filter((flow) => flow.accountId === accountId)
      .map((flow) => ({ date: flow.date, amount: flow.amount })),
  );
}

export function toAccountSummaryView(
  account: Account,
  snapshots: BalanceSnapshot[],
  transfers: Transfer[] = [],
  capitalFlows: CapitalFlow[] = [],
): AccountSummaryView {
  const accountSnapshots = snapshots
    .filter((s) => s.accountId === account.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latest = accountSnapshots[0] ?? null;
  return {
    id: account.id,
    name: account.name,
    provider: account.provider,
    currency: account.currency,
    assetType: account.assetType,
    expectedAnnualReturn: account.expectedAnnualReturn,
    isOpen: !account.closedAt,
    latestBalance: latest?.balance ?? null,
    latestSnapshotDate: latest?.date ?? null,
    // CAGR through a closing zero balance reads as a total loss, so skip it;
    // a growth rate on a debt that's being paid down is meaningless too
    cagr:
      account.closedAt || isLiability(account.assetType)
        ? null
        : computeMoneyWeightedReturn(
            accountSnapshots,
            toExternalFlows(account.id, transfers, capitalFlows),
          ),
  };
}

export function toAccountDetailView(
  account: Account,
  snapshots: BalanceSnapshot[],
  transfers: Transfer[] = [],
  capitalFlows: CapitalFlow[] = [],
): AccountDetailView {
  // Single filter and sort (descending for latest first)
  const accountSnapshots = snapshots
    .filter((s) => s.accountId === account.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const latest = accountSnapshots[0] ?? null;
  const accountCapitalFlows = capitalFlows
    .filter((flow) => flow.accountId === account.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const netContributed =
    accountCapitalFlows.length === 0
      ? null
      : accountCapitalFlows.reduce((sum, flow) => sum + flow.amount, 0);

  return {
    id: account.id,
    name: account.name,
    provider: account.provider,
    currency: account.currency,
    assetType: account.assetType,
    expectedAnnualReturn: account.expectedAnnualReturn,
    isOpen: !account.closedAt,
    latestBalance: latest?.balance ?? null,
    latestSnapshotDate: latest?.date ?? null,
    cagr: account.closedAt
      ? null
      : computeMoneyWeightedReturn(
          accountSnapshots,
          toExternalFlows(account.id, transfers, capitalFlows),
        ),
    createdAt: account.createdAt,
    expectedReturnChanges: account.expectedReturnChanges,
    linkedAccountId: account.linkedAccountId,
    closedAt: account.closedAt,
    // Reverse for ascending order for charts
    snapshots: accountSnapshots
      .map((s) => ({
        date: s.date,
        balance: s.balance,
      }))
      .reverse(),
    capitalFlows: accountCapitalFlows.map(({ date, amount, kind }) => ({
      date,
      amount,
      kind,
    })),
    netContributed,
    gainLoss:
      latest == null || netContributed == null
        ? null
        : latest.balance - netContributed,
  };
}

export function toNetWorthTimeSeries(
  accounts: Account[],
  snapshots: BalanceSnapshot[],
  capitalFlows: CapitalFlow[] = [],
): NetWorthDataPoint[] {
  const dateSet = new Set(snapshots.map((s) => s.date));
  const sortedDates = Array.from(dateSet).sort(compareIsoDates);
  const accountsWithMarketValue = new Set(
    snapshots
      .filter((snapshot) => snapshot.balance !== 0)
      .map((snapshot) => snapshot.accountId),
  );

  const sortedSnapshots = [...snapshots].sort((a, b) =>
    compareIsoDates(a.date, b.date),
  );

  // Two-pointer approach: process each snapshot only once
  const latestByAccount = new Map<string, number>();
  let snapshotIndex = 0;

  // A linked mortgage is folded into its property's series (shown as equity)
  // rather than appearing as its own negative series
  const { absorbedIds, mortgagesByProperty } = buildLinkage(accounts);

  const estimatedInvestmentTypes = new Set<AssetType>([
    "stocks",
    "bonds",
    "reits",
    "crypto",
  ]);
  const estimatesByAccount = new Map(
    accounts
      .filter(
        (account) =>
          estimatedInvestmentTypes.has(account.assetType) &&
          !absorbedIds.has(account.id),
      )
      .map((account) => [
        account.id,
        new Map(
          buildBalanceEstimateSeries(
            account,
            snapshots.filter((snapshot) => snapshot.accountId === account.id),
            capitalFlows
              .filter((flow) => flow.accountId === account.id)
              .map(({ date, amount }) => ({ date, amount })),
            sortedDates,
          ).map((point) => [point.date, point]),
        ),
      ]),
  );

  return sortedDates.map((date) => {
    // Advance pointer through snapshots up to current date
    let snapshot = sortedSnapshots[snapshotIndex];
    while (snapshot && new Date(snapshot.date) <= new Date(date)) {
      latestByAccount.set(snapshot.accountId, snapshot.balance);
      snapshotIndex++;
      snapshot = sortedSnapshots[snapshotIndex];
    }

    const point: NetWorthDataPoint = { date, total: 0 };
    for (const account of accounts) {
      if (absorbedIds.has(account.id)) continue;
      const mortgageIds = mortgagesByProperty.get(account.id) ?? [];
      const hasMarketHistory =
        accountsWithMarketValue.has(account.id) ||
        mortgageIds.some((mortgageId) =>
          accountsWithMarketValue.has(mortgageId),
        );
      const hasRecordedBalance =
        latestByAccount.has(account.id) ||
        mortgageIds.some((mortgageId) => latestByAccount.has(mortgageId));
      // A contribution history is not a market valuation. Leave accounts out
      // of the market-value series until either they or a linked mortgage have
      // a recorded balance, rather than drawing a fabricated zero line.
      if (!hasMarketHistory || !hasRecordedBalance) continue;
      let balance = latestByAccount.get(account.id) ?? 0;
      for (const mortgageId of mortgageIds) {
        balance += latestByAccount.get(mortgageId) ?? 0;
      }
      point[account.name] = balance;
      point.total += balance;
    }

    let estimatedTotal = point.total;
    let usesEstimate = false;
    for (const account of accounts) {
      if (account.closedAt != null && date > account.closedAt) continue;
      const estimate = estimatesByAccount.get(account.id)?.get(date);
      if (estimate == null || estimate.actual != null) continue;
      const recordedBalance = accountsWithMarketValue.has(account.id)
        ? (latestByAccount.get(account.id) ?? 0)
        : 0;
      estimatedTotal += estimate.estimated - recordedBalance;
      usesEstimate = true;
    }
    if (usesEstimate) {
      point.estimatedTotal = Math.round(estimatedTotal * 100) / 100;
    }
    return point;
  });
}
