import { accounts as definedAccounts } from "../../../content/assettracker/accounts";
import { recurringFlows as definedRecurringFlows } from "../../../content/assettracker/recurringFlows";
import { snapshots as definedSnapshots } from "../../../content/assettracker/snapshots";
import type { Account, AccountId } from "./account";
import {
  type AssetTrackerData,
  AssetTrackerDataSchema,
} from "./assetTrackerData";
import type { BalanceSnapshot } from "./balanceSnapshot";
import type { RecurringFlow } from "./recurringFlow";
import type { Transfer } from "./transfer";

export interface AssetTrackerRepository {
  accounts: Map<AccountId, Account>;
  snapshots: BalanceSnapshot[];
  transfers: Transfer[];
  recurringFlows: RecurringFlow[];
  settings: AssetTrackerData["settings"];
}

/**
 * The bundled demo dataset. Serves as the pristine starting state for the
 * client-side store and the content rendered into the static build.
 */
export function getSeedData(): AssetTrackerData {
  return AssetTrackerDataSchema.parse({
    accounts: definedAccounts,
    snapshots: definedSnapshots,
    transfers: [],
    recurringFlows: definedRecurringFlows,
  });
}

function indexAccounts(accounts: Account[]): Map<AccountId, Account> {
  const byId = new Map<AccountId, Account>();
  for (const account of accounts) {
    const existing = byId.get(account.id);
    if (existing) {
      throw new Error(
        `Duplicate account ID "${account.id}": "${existing.name}" and "${account.name}" both use the same ID`,
      );
    }
    byId.set(account.id, account);
  }
  return byId;
}

function assertKnownAccount(
  accounts: Map<AccountId, Account>,
  accountId: AccountId | undefined,
  referrer: string,
): void {
  if (accountId != null && !accounts.has(accountId)) {
    throw new Error(`${referrer} references unknown account "${accountId}"`);
  }
}

function validateReferences(
  data: AssetTrackerData,
  accounts: Map<AccountId, Account>,
): void {
  for (const account of data.accounts) {
    assertKnownAccount(
      accounts,
      account.linkedAccountId,
      `Account "${account.id}"`,
    );
  }
  for (const snapshot of data.snapshots) {
    assertKnownAccount(
      accounts,
      snapshot.accountId,
      `Snapshot on date ${snapshot.date}`,
    );
  }
  for (const transfer of data.transfers) {
    assertKnownAccount(
      accounts,
      transfer.fromAccountId,
      `Transfer "${transfer.id}"`,
    );
    assertKnownAccount(
      accounts,
      transfer.toAccountId,
      `Transfer "${transfer.id}"`,
    );
  }
  for (const flow of data.recurringFlows) {
    assertKnownAccount(
      accounts,
      flow.fromAccountId,
      `Recurring flow "${flow.name}"`,
    );
    assertKnownAccount(
      accounts,
      flow.toAccountId,
      `Recurring flow "${flow.name}"`,
    );
  }
}

export function buildRepository(
  data: AssetTrackerData,
): AssetTrackerRepository {
  const accounts = indexAccounts(data.accounts);
  validateReferences(data, accounts);
  const snapshots = [...data.snapshots].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  return {
    accounts,
    snapshots,
    transfers: data.transfers,
    recurringFlows: data.recurringFlows,
    settings: data.settings,
  };
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
