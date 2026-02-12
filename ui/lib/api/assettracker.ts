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

export type { AccountDetailView, AccountSummaryView, NetWorthDataPoint };

export function getAllAccounts(): AccountSummaryView[] {
  return getAllAccountSummaries(loadAssetTrackerRepository());
}

export function getAccount(accountId: string): AccountDetailView {
  const account = getAccountDetail(loadAssetTrackerRepository(), accountId);
  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }
  return account;
}

export function getAllAccountDetails(): AccountDetailView[] {
  const repo = loadAssetTrackerRepository();
  const details: AccountDetailView[] = [];
  for (const account of repo.accounts.values()) {
    try {
      details.push(getAccountDetail(repo, account.id)!);
    } catch (error) {
      console.warn(
        `Skipping account "${account.id}": ${error instanceof Error ? error.message : error}`,
      );
    }
  }
  return details;
}

export function getAccountsForAssetType(
  assetType: AssetType,
): AccountSummaryView[] {
  return getAccountsByAssetType(loadAssetTrackerRepository(), assetType);
}

export function getNetWorthData(): NetWorthDataPoint[] {
  return getNetWorthTimeSeries(loadAssetTrackerRepository());
}

export function getAssetAllocation(): {
  assetType: AssetType;
  total: number;
}[] {
  return getTotalByAssetType(loadAssetTrackerRepository());
}
