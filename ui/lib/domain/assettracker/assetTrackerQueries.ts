import type { AccountId, AssetType } from "./account";
import type { AssetTrackerRepository } from "./assetTrackerRepository";
import {
  type AccountDetailView,
  type AccountSummaryView,
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
    toAccountSummaryView(account, repository.snapshots),
  );
}

export function getAccountDetail(
  repository: AssetTrackerRepository,
  accountId: AccountId,
): AccountDetailView | null {
  const account = repository.accounts.get(accountId);
  if (!account) return null;
  return toAccountDetailView(account, repository.snapshots);
}

export function getAllAccountDetails(
  repository: AssetTrackerRepository,
): AccountDetailView[] {
  return Array.from(repository.accounts.values()).map((account) =>
    toAccountDetailView(account, repository.snapshots),
  );
}

export function getAccountsByAssetType(
  repository: AssetTrackerRepository,
  assetType: AssetType,
): AccountSummaryView[] {
  return Array.from(repository.accounts.values())
    .filter((account) => account.assetType === assetType)
    .map((account) => toAccountSummaryView(account, repository.snapshots));
}

export function getNetWorthTimeSeries(
  repository: AssetTrackerRepository,
): NetWorthDataPoint[] {
  return toNetWorthTimeSeries(
    Array.from(repository.accounts.values()),
    repository.snapshots,
  );
}

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

  // Sum by asset type
  for (const account of repository.accounts.values()) {
    const latestSnapshot = latestSnapshots.get(account.id);
    if (latestSnapshot) {
      const currentTotal = totals.get(account.assetType) ?? 0;
      totals.set(account.assetType, currentTotal + latestSnapshot.balance);
    }
  }

  return Array.from(totals.entries()).map(([assetType, total]) => ({
    assetType,
    total,
  }));
}
