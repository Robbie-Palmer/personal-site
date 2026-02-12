import {
  type AccountDetailView,
  type AccountSummaryView,
  type AssetTrackerRepository,
  type AssetType,
  getAccountDetail,
  getAccountsByAssetType,
  getAllAccountSummaries,
  getNetWorthTimeSeries,
  getTotalByAssetType,
  loadAssetTrackerRepository,
  type NetWorthDataPoint,
} from "@/lib/domain/assettracker";

let repository: AssetTrackerRepository | null = null;

function getRepository(): AssetTrackerRepository {
  if (!repository) {
    repository = loadAssetTrackerRepository();
  }
  return repository;
}

export type { AccountDetailView, AccountSummaryView, NetWorthDataPoint };

export function getAllAccounts(): AccountSummaryView[] {
  return getAllAccountSummaries(getRepository());
}

export function getAccount(accountId: string): AccountDetailView {
  const account = getAccountDetail(getRepository(), accountId);
  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }
  return account;
}

export function getAllAccountDetails(): AccountDetailView[] {
  const repo = getRepository();
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
  return getAccountsByAssetType(getRepository(), assetType);
}

export function getNetWorthData(): NetWorthDataPoint[] {
  return getNetWorthTimeSeries(getRepository());
}

export function getAssetAllocation(): {
  assetType: AssetType;
  total: number;
}[] {
  return getTotalByAssetType(getRepository());
}
