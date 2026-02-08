import { accounts as definedAccounts } from "../../../content/assettracker/accounts";
import { snapshots as definedSnapshots } from "../../../content/assettracker/snapshots";
import type { Account, AccountId } from "./account";
import type { BalanceSnapshot } from "./balanceSnapshot";

export interface AssetTrackerRepository {
  accounts: Map<AccountId, Account>;
  snapshots: BalanceSnapshot[];
}

function loadAccounts(): Map<AccountId, Account> {
  const map = new Map<AccountId, Account>();
  for (const account of definedAccounts) {
    const existing = map.get(account.id);
    if (existing) {
      throw new Error(
        `Duplicate account ID "${account.id}": "${existing.name}" and "${account.name}" both use the same ID`,
      );
    }
    map.set(account.id, account);
  }
  return map;
}

function loadSnapshots(accounts: Map<AccountId, Account>): BalanceSnapshot[] {
  const allSnapshots = [...definedSnapshots];
  for (const snapshot of allSnapshots) {
    if (!accounts.has(snapshot.accountId)) {
      throw new Error(
        `Snapshot references unknown account "${snapshot.accountId}" on date ${snapshot.date}`,
      );
    }
  }
  return allSnapshots.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

let cachedRepository: AssetTrackerRepository | null = null;

export function loadAssetTrackerRepository(): AssetTrackerRepository {
  if (cachedRepository) return cachedRepository;
  const accounts = loadAccounts();
  const snapshots = loadSnapshots(accounts);
  cachedRepository = { accounts, snapshots };
  return cachedRepository;
}
