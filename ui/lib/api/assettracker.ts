import {
  type AccountDetailView,
  type AccountSummaryView,
  type AssetType,
  getAccountDetail,
  getAccountsByAssetType,
  getAllAccountSummaries,
  getNetWorthTimeSeries,
  getTotalByAssetType,
  loadAssetTrackerRepository,
  type NetWorthDataPoint,
} from "@/lib/domain/assettracker";

const repository = loadAssetTrackerRepository();

export type { AccountDetailView, AccountSummaryView, NetWorthDataPoint };

export function getAllAccounts(): AccountSummaryView[] {
  return getAllAccountSummaries(repository);
}

export function getAccount(accountId: string): AccountDetailView {
  const account = getAccountDetail(repository, accountId);
  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }
  return account;
}

export function getAccountsForAssetType(
  assetType: AssetType,
): AccountSummaryView[] {
  return getAccountsByAssetType(repository, assetType);
}

export function getNetWorthData(): NetWorthDataPoint[] {
  return getNetWorthTimeSeries(repository);
}

export function getAssetAllocation(): {
  assetType: AssetType;
  total: number;
}[] {
  return getTotalByAssetType(repository);
}
