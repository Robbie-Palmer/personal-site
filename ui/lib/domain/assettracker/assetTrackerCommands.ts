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
import type { BalanceSnapshot } from "./balanceSnapshot";
import {
  FlowFrequencySchema,
  flowOccurrenceDates,
  MinimumPaymentFormulaSchema,
  monthlyAmount,
} from "./recurringFlow";

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
  | "ACCOUNT_HAS_LATER_HISTORY"
  | "SNAPSHOT_NOT_FOUND"
  | "FLOW_NOT_FOUND"
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

// Compounding below a total loss per year is meaningless; there is no upper
// bound — nothing stops an asset being expected to more than double
const AnnualRateSchema = z
  .number()
  .gt(-1, "Expected return must be above -100%");

export const CreateAccountInputSchema = z.object({
  name: z.string().trim().min(1, "Account name is required"),
  provider: z.string().trim().min(1, "Provider is required"),
  currency: CurrencySchema,
  assetType: AssetTypeSchema,
  expectedAnnualReturn: AnnualRateSchema,
  /** e.g. the property a mortgage is secured on */
  linkedAccountId: AccountIdSchema.optional(),
  openingBalance: z.number().optional(),
  openingDate: IsoDateSchema.optional(),
});
export type CreateAccountInput = z.infer<typeof CreateAccountInputSchema>;

export const RecordBalanceInputSchema = z.object({
  accountId: AccountIdSchema,
  date: IsoDateSchema,
  // Negative balances are valid: debt accounts, overdrafts
  balance: z.number(),
});
export type RecordBalanceInput = z.infer<typeof RecordBalanceInputSchema>;

export const CloseAccountInputSchema = z
  .object({
    accountId: AccountIdSchema,
    closedAt: IsoDateSchema,
    /** Move the remaining balance here before closing */
    transferToAccountId: AccountIdSchema.optional(),
  })
  .refine((input) => input.transferToAccountId !== input.accountId, {
    message: "Cannot transfer the balance to the account being closed",
  });
export type CloseAccountInput = z.infer<typeof CloseAccountInputSchema>;

export const DeleteSnapshotInputSchema = z.object({
  accountId: AccountIdSchema,
  date: IsoDateSchema,
});
export type DeleteSnapshotInput = z.infer<typeof DeleteSnapshotInputSchema>;

export const RecordTransferInputSchema = z
  .object({
    date: IsoDateSchema,
    /** Omit for external income */
    fromAccountId: AccountIdSchema.optional(),
    /** Omit for external spending */
    toAccountId: AccountIdSchema.optional(),
    amount: z.number().positive("Amount must be positive"),
    /** Links the transfer back to the recurring flow that produced it */
    flowId: z.string().min(1).optional(),
  })
  .refine((t) => t.fromAccountId != null || t.toAccountId != null, {
    message: "A transfer needs a source or a destination account",
  })
  .refine((t) => t.fromAccountId !== t.toAccountId, {
    message: "Source and destination must differ",
  });
export type RecordTransferInput = z.infer<typeof RecordTransferInputSchema>;

export const AddRecurringFlowInputSchema = z
  .object({
    name: z.string().trim().min(1, "Give the flow a name"),
    fromAccountId: AccountIdSchema.optional(),
    toAccountId: AccountIdSchema.optional(),
    amount: z.number().positive("Amount must be positive").optional(),
    formula: MinimumPaymentFormulaSchema.optional(),
    frequency: FlowFrequencySchema,
    startDate: IsoDateSchema.optional(),
    endDate: IsoDateSchema.optional(),
  })
  .refine((f) => f.fromAccountId != null || f.toAccountId != null, {
    message: "A flow needs a source or a destination account",
  })
  .refine((f) => f.fromAccountId !== f.toAccountId, {
    message: "Source and destination must differ",
  })
  .refine((f) => (f.amount != null) !== (f.formula != null), {
    message: "Provide either an amount or a formula, not both",
  })
  .refine((f) => f.formula == null || f.frequency === "monthly", {
    message: "Formula payments must use a monthly frequency",
  });
export type AddRecurringFlowInput = z.infer<typeof AddRecurringFlowInputSchema>;

export const DeleteRecurringFlowInputSchema = z.object({
  id: z.string().min(1),
});
export type DeleteRecurringFlowInput = z.infer<
  typeof DeleteRecurringFlowInputSchema
>;

export const SetExpectedReturnInputSchema = z.object({
  accountId: AccountIdSchema,
  rate: AnnualRateSchema,
  effectiveFrom: IsoDateSchema,
});
export type SetExpectedReturnInput = z.infer<
  typeof SetExpectedReturnInputSchema
>;

export const MaterializeFlowInputSchema = z.object({
  flowId: z.string().min(1),
  /** Generate occurrences up to and including this date */
  throughDate: IsoDateSchema,
});
export type MaterializeFlowInput = z.infer<typeof MaterializeFlowInputSchema>;

export const SetInflationInputSchema = z.object({
  rate: AnnualRateSchema,
});
export type SetInflationInput = z.infer<typeof SetInflationInputSchema>;

export const SetNetWorthTargetInputSchema = z.object({
  /** Null clears the target */
  target: z.number().positive("Target must be positive").nullable(),
  /** Interpret the target in today's money rather than nominal future money */
  inTodaysMoney: z.boolean().optional(),
});
export type SetNetWorthTargetInput = z.infer<
  typeof SetNetWorthTargetInputSchema
>;

export function todayIsoDate(): string {
  // Local calendar date, not UTC — toISOString() would roll over around
  // local midnight and record the wrong day
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function uniqueId(taken: Set<string>, base: string): string {
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}

function uniqueAccountId(data: AssetTrackerData, name: string): AccountId {
  const base = normalizeSlug(name);
  if (!base) {
    throw new AssetTrackerCommandError(
      "INVALID_ACCOUNT_NAME",
      `Cannot derive an ID from account name "${name}"`,
    );
  }
  return uniqueId(new Set(data.accounts.map((account) => account.id)), base);
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

function requireOpenOn(
  data: AssetTrackerData,
  accountId: AccountId,
  date: string,
): Account {
  const account = requireAccount(data, accountId);
  // Backfilling history up to the closure date is allowed
  if (account.closedAt && date > account.closedAt) {
    throw new AssetTrackerCommandError(
      "ACCOUNT_CLOSED",
      `"${account.name}" closed on ${account.closedAt}; cannot record changes after that`,
    );
  }
  return account;
}

function upsertSnapshot(
  snapshots: BalanceSnapshot[],
  snapshot: BalanceSnapshot,
): BalanceSnapshot[] {
  const others = snapshots.filter(
    (s) => !(s.accountId === snapshot.accountId && s.date === snapshot.date),
  );
  return [...others, snapshot];
}

/** The recorded balance in force on a date: latest snapshot on or before it */
export function balanceAsOf(
  snapshots: BalanceSnapshot[],
  accountId: AccountId,
  date: string,
): number {
  const applicable = snapshots
    .filter((s) => s.accountId === accountId && s.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date));
  return applicable[applicable.length - 1]?.balance ?? 0;
}

export function applyCreateAccount(
  data: AssetTrackerData,
  input: CreateAccountInput,
): { data: AssetTrackerData; account: Account } {
  const parsed = CreateAccountInputSchema.parse(input);
  if (parsed.linkedAccountId != null) {
    requireAccount(data, parsed.linkedAccountId);
  }
  const openingDate = parsed.openingDate ?? todayIsoDate();
  const account = AccountContentSchema.parse({
    id: uniqueAccountId(data, parsed.name),
    name: parsed.name,
    provider: parsed.provider,
    currency: parsed.currency,
    assetType: parsed.assetType,
    expectedAnnualReturn: parsed.expectedAnnualReturn,
    linkedAccountId: parsed.linkedAccountId,
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
    data: { ...data, accounts: [...data.accounts, account], snapshots },
    account,
  };
}

export function applyRecordBalance(
  data: AssetTrackerData,
  input: RecordBalanceInput,
): AssetTrackerData {
  const parsed = RecordBalanceInputSchema.parse(input);
  requireOpenOn(data, parsed.accountId, parsed.date);
  return { ...data, snapshots: upsertSnapshot(data.snapshots, parsed) };
}

export function applyRecordTransfer(
  data: AssetTrackerData,
  input: RecordTransferInput,
): AssetTrackerData {
  const parsed = RecordTransferInputSchema.parse(input);
  let snapshots = data.snapshots;
  if (parsed.fromAccountId != null) {
    requireOpenOn(data, parsed.fromAccountId, parsed.date);
    snapshots = upsertSnapshot(snapshots, {
      accountId: parsed.fromAccountId,
      date: parsed.date,
      balance:
        balanceAsOf(data.snapshots, parsed.fromAccountId, parsed.date) -
        parsed.amount,
    });
  }
  if (parsed.toAccountId != null) {
    requireOpenOn(data, parsed.toAccountId, parsed.date);
    snapshots = upsertSnapshot(snapshots, {
      accountId: parsed.toAccountId,
      date: parsed.date,
      balance:
        balanceAsOf(data.snapshots, parsed.toAccountId, parsed.date) +
        parsed.amount,
    });
  }
  const taken = new Set(data.transfers.map((t) => t.id));
  const transfer = {
    id: uniqueId(taken, `transfer-${parsed.date}`),
    date: parsed.date,
    fromAccountId: parsed.fromAccountId,
    toAccountId: parsed.toAccountId,
    amount: parsed.amount,
    flowId: parsed.flowId,
  };
  return { ...data, snapshots, transfers: [...data.transfers, transfer] };
}

/**
 * Realises a recurring flow into actual transfers from its start (or the day
 * after its last already-recorded transfer) through `throughDate`. Each
 * occurrence debits the source and credits the destination, so the recorded
 * balances — and the trajectory and CAGR that read them — reflect the money
 * actually moving. Re-running only tops up newly-due periods. Formula amounts
 * are evaluated against the liability's running balance at each step, and a
 * period with nothing due (debt cleared) is skipped.
 */
export function applyMaterializeFlow(
  data: AssetTrackerData,
  input: MaterializeFlowInput,
): AssetTrackerData {
  const parsed = MaterializeFlowInputSchema.parse(input);
  const flow = data.recurringFlows.find((f) => f.id === parsed.flowId);
  if (!flow) {
    throw new AssetTrackerCommandError(
      "FLOW_NOT_FOUND",
      `No recurring flow found with ID ${parsed.flowId}`,
    );
  }
  const lastRecorded = data.transfers
    .filter((t) => t.flowId === flow.id)
    .map((t) => t.date)
    .sort()
    .at(-1);
  const dates = flowOccurrenceDates(flow, parsed.throughDate, lastRecorded);

  let working = data;
  for (const date of dates) {
    const liabilityBalance =
      flow.toAccountId != null
        ? balanceAsOf(working.snapshots, flow.toAccountId, date)
        : undefined;
    const amount =
      flow.formula != null
        ? monthlyAmount(flow, liabilityBalance)
        : (flow.amount ?? 0);
    if (amount <= 0) continue;
    working = applyRecordTransfer(working, {
      date,
      fromAccountId: flow.fromAccountId,
      toAccountId: flow.toAccountId,
      amount,
      flowId: flow.id,
    });
  }
  return working;
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
  // Closing before later history would strand those snapshots, so the account
  // would reappear in net-worth views after its close date
  const hasLaterHistory = data.snapshots.some(
    (s) => s.accountId === account.id && s.date > parsed.closedAt,
  );
  if (hasLaterHistory) {
    throw new AssetTrackerCommandError(
      "ACCOUNT_HAS_LATER_HISTORY",
      `"${account.name}" has balances recorded after ${parsed.closedAt}; delete them before closing`,
    );
  }

  let working = data;
  const remaining = balanceAsOf(data.snapshots, account.id, parsed.closedAt);
  if (parsed.transferToAccountId != null && remaining > 0) {
    working = applyRecordTransfer(working, {
      date: parsed.closedAt,
      fromAccountId: account.id,
      toAccountId: parsed.transferToAccountId,
      amount: remaining,
    });
  }
  const accounts = working.accounts.map((a) =>
    a.id === account.id ? { ...a, closedAt: parsed.closedAt } : a,
  );
  // Record the final zero balance so net worth trends stay accurate without
  // the user manually entering rows of zeros — but never clobber a balance the
  // user already recorded for the close date
  const hasSnapshotOnCloseDate = working.snapshots.some(
    (s) => s.accountId === account.id && s.date === parsed.closedAt,
  );
  const snapshots = hasSnapshotOnCloseDate
    ? working.snapshots
    : upsertSnapshot(working.snapshots, {
        accountId: account.id,
        date: parsed.closedAt,
        balance: 0,
      });
  return { ...working, accounts, snapshots };
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

export function applyAddRecurringFlow(
  data: AssetTrackerData,
  input: AddRecurringFlowInput,
): AssetTrackerData {
  const parsed = AddRecurringFlowInputSchema.parse(input);
  const startDate = parsed.startDate ?? todayIsoDate();
  for (const accountId of [parsed.fromAccountId, parsed.toAccountId]) {
    if (accountId != null) requireOpenOn(data, accountId, startDate);
  }
  const base = normalizeSlug(parsed.name) || "flow";
  const flow = {
    id: uniqueId(new Set(data.recurringFlows.map((f) => f.id)), base),
    name: parsed.name,
    fromAccountId: parsed.fromAccountId,
    toAccountId: parsed.toAccountId,
    amount: parsed.amount,
    formula: parsed.formula,
    frequency: parsed.frequency,
    startDate,
    endDate: parsed.endDate,
  };
  return { ...data, recurringFlows: [...data.recurringFlows, flow] };
}

export function applyDeleteRecurringFlow(
  data: AssetTrackerData,
  input: DeleteRecurringFlowInput,
): AssetTrackerData {
  const parsed = DeleteRecurringFlowInputSchema.parse(input);
  const recurringFlows = data.recurringFlows.filter((f) => f.id !== parsed.id);
  if (recurringFlows.length === data.recurringFlows.length) {
    throw new AssetTrackerCommandError(
      "FLOW_NOT_FOUND",
      `No recurring flow found with ID ${parsed.id}`,
    );
  }
  return { ...data, recurringFlows };
}

export function applySetExpectedReturn(
  data: AssetTrackerData,
  input: SetExpectedReturnInput,
): AssetTrackerData {
  const parsed = SetExpectedReturnInputSchema.parse(input);
  const account = requireAccount(data, parsed.accountId);
  const changes = [
    ...(account.expectedReturnChanges ?? []).filter(
      (change) => change.date !== parsed.effectiveFrom,
    ),
    { date: parsed.effectiveFrom, rate: parsed.rate },
  ].sort((a, b) => a.date.localeCompare(b.date));
  const accounts = data.accounts.map((a) =>
    a.id === account.id ? { ...a, expectedReturnChanges: changes } : a,
  );
  return { ...data, accounts };
}

export function applySetInflation(
  data: AssetTrackerData,
  input: SetInflationInput,
): AssetTrackerData {
  const parsed = SetInflationInputSchema.parse(input);
  return {
    ...data,
    settings: { ...data.settings, expectedAnnualInflation: parsed.rate },
  };
}

export function applySetNetWorthTarget(
  data: AssetTrackerData,
  input: SetNetWorthTargetInput,
): AssetTrackerData {
  const parsed = SetNetWorthTargetInputSchema.parse(input);
  const cleared = parsed.target == null;
  return {
    ...data,
    settings: {
      ...data.settings,
      targetNetWorth: parsed.target ?? undefined,
      targetNetWorthIsReal: cleared
        ? undefined
        : (parsed.inTodaysMoney ?? false),
    },
  };
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
