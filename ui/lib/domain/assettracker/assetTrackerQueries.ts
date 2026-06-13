import type { AccountId, AssetType } from "./account";
import {
  computeMoneyWeightedReturn,
  type ExternalFlow,
} from "./assetTrackerAnalytics";
import type { AssetTrackerRepository } from "./assetTrackerRepository";
import {
  type AccountDetailView,
  type AccountSummaryView,
  buildLinkage,
  type NetWorthDataPoint,
  toAccountDetailView,
  toAccountSummaryView,
  toNetWorthTimeSeries,
} from "./assetTrackerViews";
import type { BalanceSnapshot } from "./balanceSnapshot";

export function getAllAccountSummaries(
  repository: AssetTrackerRepository,
): AccountSummaryView[] {
  return Array.from(repository.accounts.values()).map((account) =>
    toAccountSummaryView(account, repository.snapshots, repository.transfers),
  );
}

export function getAccountDetail(
  repository: AssetTrackerRepository,
  accountId: AccountId,
): AccountDetailView | null {
  const account = repository.accounts.get(accountId);
  if (!account) return null;
  return toAccountDetailView(
    account,
    repository.snapshots,
    repository.transfers,
  );
}

export function getAllAccountDetails(
  repository: AssetTrackerRepository,
): AccountDetailView[] {
  return Array.from(repository.accounts.values()).map((account) =>
    toAccountDetailView(account, repository.snapshots, repository.transfers),
  );
}

export function getAccountsByAssetType(
  repository: AssetTrackerRepository,
  assetType: AssetType,
): AccountSummaryView[] {
  return Array.from(repository.accounts.values())
    .filter((account) => account.assetType === assetType)
    .map((account) =>
      toAccountSummaryView(account, repository.snapshots, repository.transfers),
    );
}

export function getNetWorthTimeSeries(
  repository: AssetTrackerRepository,
): NetWorthDataPoint[] {
  return toNetWorthTimeSeries(
    Array.from(repository.accounts.values()),
    repository.snapshots,
  );
}

/**
 * Annualised growth of the whole portfolio, excluding external money in/out
 * (recorded transfers with an external side). Internal transfers between
 * accounts cancel out of the net worth total, so they need no adjustment.
 */
export function getPortfolioAnnualReturn(
  repository: AssetTrackerRepository,
): number | null {
  const netWorth = getNetWorthTimeSeries(repository);
  const balances = netWorth.map((point) => ({
    date: point.date,
    balance: point.total,
  }));
  const externalFlows: ExternalFlow[] = [];
  for (const transfer of repository.transfers) {
    if (transfer.fromAccountId == null && transfer.toAccountId != null) {
      externalFlows.push({ date: transfer.date, amount: transfer.amount });
    } else if (transfer.toAccountId == null && transfer.fromAccountId != null) {
      externalFlows.push({ date: transfer.date, amount: -transfer.amount });
    }
  }
  return computeMoneyWeightedReturn(balances, externalFlows);
}

/**
 * Net worth composition by asset type. Mortgages secured on a property are
 * folded into that property (so it contributes equity, not gross value);
 * other liabilities surface as their own negative totals.
 */
export function getTotalByAssetType(
  repository: AssetTrackerRepository,
): { assetType: AssetType; total: number }[] {
  const totals = new Map<AssetType, number>();

  // Find latest snapshot for each account in single pass
  const latestSnapshots = new Map<AccountId, BalanceSnapshot>();
  for (const snapshot of repository.snapshots) {
    const existing = latestSnapshots.get(snapshot.accountId);
    if (!existing || new Date(snapshot.date) > new Date(existing.date)) {
      latestSnapshots.set(snapshot.accountId, snapshot);
    }
  }

  const accounts = Array.from(repository.accounts.values());
  const { absorbedIds, mortgagesByProperty } = buildLinkage(accounts);

  for (const account of accounts) {
    if (absorbedIds.has(account.id)) continue;
    let balance = latestSnapshots.get(account.id)?.balance ?? 0;
    for (const mortgageId of mortgagesByProperty.get(account.id) ?? []) {
      balance += latestSnapshots.get(mortgageId)?.balance ?? 0;
    }
    totals.set(
      account.assetType,
      (totals.get(account.assetType) ?? 0) + balance,
    );
  }

  return Array.from(totals.entries()).map(([assetType, total]) => ({
    assetType,
    total,
  }));
}
