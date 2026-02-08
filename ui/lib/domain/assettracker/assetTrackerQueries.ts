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
  const summaries = getAllAccountSummaries(repository);
  for (const summary of summaries) {
    if (summary.latestBalance != null) {
      const current = totals.get(summary.assetType) ?? 0;
      totals.set(summary.assetType, current + summary.latestBalance);
    }
  }
  return Array.from(totals.entries()).map(([assetType, total]) => ({
    assetType,
    total,
  }));
}
