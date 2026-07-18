import {
  type Account,
  type AssetType,
  type Currency,
  type ExpectedReturnChange,
  isLiability,
} from "./account";
import {
  computeMoneyWeightedReturn,
  type ExternalFlow,
} from "./assetTrackerAnalytics";
import type { BalanceSnapshot } from "./balanceSnapshot";
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
};

export type NetWorthDataPoint = {
  date: string;
  total: number;
  [accountName: string]: string | number;
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

/** Recorded transfers as signed flows from the account's perspective */
function toExternalFlows(
  accountId: string,
  transfers: Transfer[],
): ExternalFlow[] {
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

export function toAccountSummaryView(
  account: Account,
  snapshots: BalanceSnapshot[],
  transfers: Transfer[] = [],
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
            toExternalFlows(account.id, transfers),
          ),
  };
}

export function toAccountDetailView(
  account: Account,
  snapshots: BalanceSnapshot[],
  transfers: Transfer[] = [],
): AccountDetailView {
  // Single filter and sort (descending for latest first)
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
    cagr: account.closedAt
      ? null
      : computeMoneyWeightedReturn(
          accountSnapshots,
          toExternalFlows(account.id, transfers),
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
  };
}

export function toNetWorthTimeSeries(
  accounts: Account[],
  snapshots: BalanceSnapshot[],
): NetWorthDataPoint[] {
  const dateSet = new Set(snapshots.map((s) => s.date));
  const sortedDates = Array.from(dateSet).sort(compareIsoDates);

  const sortedSnapshots = [...snapshots].sort((a, b) =>
    compareIsoDates(a.date, b.date),
  );

  // Two-pointer approach: process each snapshot only once
  const latestByAccount = new Map<string, number>();
  let snapshotIndex = 0;

  // A linked mortgage is folded into its property's series (shown as equity)
  // rather than appearing as its own negative series
  const { absorbedIds, mortgagesByProperty } = buildLinkage(accounts);

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
      let balance = latestByAccount.get(account.id) ?? 0;
      for (const mortgageId of mortgagesByProperty.get(account.id) ?? []) {
        balance += latestByAccount.get(mortgageId) ?? 0;
      }
      point[account.name] = balance;
      point.total += balance;
    }
    return point;
  });
}
