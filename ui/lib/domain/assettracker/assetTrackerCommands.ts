import { z } from "zod";
import { normalizeSlug } from "../../generic/slugs";
import {
  type Account,
  AccountContentSchema,
  type AccountId,
  AccountIdSchema,
  AssetTypeSchema,
  CurrencySchema,
} from "./account";
import type { AssetTrackerData } from "./assetTrackerData";

/**
 * Commands are the write-side of the tracker: zod-validated inputs applied
 * by pure functions that return the next state. The browser store runs them
 * against local data today; a future Worker endpoint validates the same
 * schemas and runs the same appliers against D1.
 */

export type AssetTrackerCommandErrorCode =
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_CLOSED"
  | "ACCOUNT_ALREADY_CLOSED"
  | "SNAPSHOT_NOT_FOUND"
  | "INVALID_ACCOUNT_NAME";

export class AssetTrackerCommandError extends Error {
  readonly code: AssetTrackerCommandErrorCode;

  constructor(code: AssetTrackerCommandErrorCode, message: string) {
    super(message);
    this.name = "AssetTrackerCommandError";
    this.code = code;
  }
}

const IsoDateSchema = z.iso.date();

export const CreateAccountInputSchema = z.object({
  name: z.string().trim().min(1, "Account name is required"),
  provider: z.string().trim().min(1, "Provider is required"),
  currency: CurrencySchema,
  assetType: AssetTypeSchema,
  expectedAnnualReturn: z
    .number()
    .gt(-1, "Expected return must be above -100%")
    .lt(1, "Expected return must be below 100%"),
  openingBalance: z.number().nonnegative().optional(),
  openingDate: IsoDateSchema.optional(),
});
export type CreateAccountInput = z.infer<typeof CreateAccountInputSchema>;

export const RecordBalanceInputSchema = z.object({
  accountId: AccountIdSchema,
  date: IsoDateSchema,
  balance: z.number().nonnegative("Balance cannot be negative"),
});
export type RecordBalanceInput = z.infer<typeof RecordBalanceInputSchema>;

export const CloseAccountInputSchema = z.object({
  accountId: AccountIdSchema,
  closedAt: IsoDateSchema,
});
export type CloseAccountInput = z.infer<typeof CloseAccountInputSchema>;

export const DeleteSnapshotInputSchema = z.object({
  accountId: AccountIdSchema,
  date: IsoDateSchema,
});
export type DeleteSnapshotInput = z.infer<typeof DeleteSnapshotInputSchema>;

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function uniqueAccountId(data: AssetTrackerData, name: string): AccountId {
  const base = normalizeSlug(name);
  if (!base) {
    throw new AssetTrackerCommandError(
      "INVALID_ACCOUNT_NAME",
      `Cannot derive an ID from account name "${name}"`,
    );
  }
  const taken = new Set(data.accounts.map((account) => account.id));
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}

function requireAccount(data: AssetTrackerData, accountId: AccountId): Account {
  const account = data.accounts.find((a) => a.id === accountId);
  if (!account) {
    throw new AssetTrackerCommandError(
      "ACCOUNT_NOT_FOUND",
      `Account not found: ${accountId}`,
    );
  }
  return account;
}

function upsertSnapshot(
  snapshots: AssetTrackerData["snapshots"],
  snapshot: AssetTrackerData["snapshots"][number],
): AssetTrackerData["snapshots"] {
  const others = snapshots.filter(
    (s) => !(s.accountId === snapshot.accountId && s.date === snapshot.date),
  );
  return [...others, snapshot];
}

export function applyCreateAccount(
  data: AssetTrackerData,
  input: CreateAccountInput,
): { data: AssetTrackerData; account: Account } {
  const parsed = CreateAccountInputSchema.parse(input);
  const openingDate = parsed.openingDate ?? todayIsoDate();
  const account = AccountContentSchema.parse({
    id: uniqueAccountId(data, parsed.name),
    name: parsed.name,
    provider: parsed.provider,
    currency: parsed.currency,
    assetType: parsed.assetType,
    expectedAnnualReturn: parsed.expectedAnnualReturn,
    createdAt: openingDate,
  });
  const snapshots =
    parsed.openingBalance != null
      ? [
          ...data.snapshots,
          {
            accountId: account.id,
            date: openingDate,
            balance: parsed.openingBalance,
          },
        ]
      : data.snapshots;
  return {
    data: { accounts: [...data.accounts, account], snapshots },
    account,
  };
}

export function applyRecordBalance(
  data: AssetTrackerData,
  input: RecordBalanceInput,
): AssetTrackerData {
  const parsed = RecordBalanceInputSchema.parse(input);
  const account = requireAccount(data, parsed.accountId);
  // Backfilling history up to the closure date is allowed
  if (account.closedAt && parsed.date > account.closedAt) {
    throw new AssetTrackerCommandError(
      "ACCOUNT_CLOSED",
      `"${account.name}" closed on ${account.closedAt}; cannot record a later balance`,
    );
  }
  return { ...data, snapshots: upsertSnapshot(data.snapshots, parsed) };
}

export function applyCloseAccount(
  data: AssetTrackerData,
  input: CloseAccountInput,
): AssetTrackerData {
  const parsed = CloseAccountInputSchema.parse(input);
  const account = requireAccount(data, parsed.accountId);
  if (account.closedAt) {
    throw new AssetTrackerCommandError(
      "ACCOUNT_ALREADY_CLOSED",
      `"${account.name}" is already closed`,
    );
  }
  const accounts = data.accounts.map((a) =>
    a.id === account.id ? { ...a, closedAt: parsed.closedAt } : a,
  );
  // Record the final zero balance so net worth trends stay accurate without
  // the user manually entering rows of zeros
  const snapshots = upsertSnapshot(data.snapshots, {
    accountId: account.id,
    date: parsed.closedAt,
    balance: 0,
  });
  return { accounts, snapshots };
}

export function applyDeleteSnapshot(
  data: AssetTrackerData,
  input: DeleteSnapshotInput,
): AssetTrackerData {
  const parsed = DeleteSnapshotInputSchema.parse(input);
  requireAccount(data, parsed.accountId);
  const snapshots = data.snapshots.filter(
    (s) => !(s.accountId === parsed.accountId && s.date === parsed.date),
  );
  if (snapshots.length === data.snapshots.length) {
    throw new AssetTrackerCommandError(
      "SNAPSHOT_NOT_FOUND",
      `No balance recorded for ${parsed.accountId} on ${parsed.date}`,
    );
  }
  return { ...data, snapshots };
}

/** Maps validation and command failures to a message safe to show in a form */
export function formatAssetTrackerError(error: unknown): string {
  if (error instanceof AssetTrackerCommandError) return error.message;
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Invalid input";
  }
  if (error instanceof SyntaxError) return "File is not valid JSON";
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}
