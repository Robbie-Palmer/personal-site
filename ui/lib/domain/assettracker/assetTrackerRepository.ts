import { accounts as definedAccounts } from "../../../content/assettracker/accounts";
import { snapshots as definedSnapshots } from "../../../content/assettracker/snapshots";
import type { Account, AccountId } from "./account";
import {
  type AssetTrackerData,
  AssetTrackerDataSchema,
} from "./assetTrackerData";
import type { BalanceSnapshot } from "./balanceSnapshot";

export interface AssetTrackerRepository {
  accounts: Map<AccountId, Account>;
  snapshots: BalanceSnapshot[];
}

/**
 * The bundled demo dataset. Serves as the pristine starting state for the
 * client-side store and the content rendered into the static build.
 */
export function getSeedData(): AssetTrackerData {
  return AssetTrackerDataSchema.parse({
    accounts: definedAccounts,
    snapshots: definedSnapshots,
  });
}

export function buildRepository(
  data: AssetTrackerData,
): AssetTrackerRepository {
  const accounts = new Map<AccountId, Account>();
  for (const account of data.accounts) {
    const existing = accounts.get(account.id);
    if (existing) {
      throw new Error(
        `Duplicate account ID "${account.id}": "${existing.name}" and "${account.name}" both use the same ID`,
      );
    }
    accounts.set(account.id, account);
  }
  for (const snapshot of data.snapshots) {
    if (!accounts.has(snapshot.accountId)) {
      throw new Error(
        `Snapshot references unknown account "${snapshot.accountId}" on date ${snapshot.date}`,
      );
    }
  }
  const snapshots = [...data.snapshots].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  return { accounts, snapshots };
}

let cachedRepository: AssetTrackerRepository | null = null;

export function loadAssetTrackerRepository(): AssetTrackerRepository {
  if (cachedRepository) return cachedRepository;
  cachedRepository = buildRepository(getSeedData());
  return cachedRepository;
}

export function resetRepositoryCache(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("resetRepositoryCache is only available in test env");
  }

  cachedRepository = null;
}
