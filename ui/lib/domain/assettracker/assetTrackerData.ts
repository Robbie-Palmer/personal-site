import { z } from "zod";
import { AccountContentSchema } from "./account";
import { BalanceSnapshotSchema } from "./balanceSnapshot";
import { RecurringFlowSchema } from "./recurringFlow";
import { TransferSchema } from "./transfer";

/**
 * The full serializable state of a user's tracker. This is the unit of
 * persistence: today it round-trips through browser storage and JSON
 * export/import; a future backend persists the same shape in D1.
 *
 * transfers and recurringFlows default to empty so data saved by earlier
 * versions still parses.
 */
export const DEFAULT_EXPECTED_INFLATION = 0.025;

export const AssetTrackerSettingsSchema = z.object({
  /** Used to express projected values and rates in today's money */
  expectedAnnualInflation: z.number().gt(-1),
});
export type AssetTrackerSettings = z.infer<typeof AssetTrackerSettingsSchema>;

export const AssetTrackerDataSchema = z.object({
  accounts: z.array(AccountContentSchema),
  snapshots: z.array(BalanceSnapshotSchema),
  transfers: z.array(TransferSchema).default([]),
  recurringFlows: z.array(RecurringFlowSchema).default([]),
  settings: AssetTrackerSettingsSchema.default({
    expectedAnnualInflation: DEFAULT_EXPECTED_INFLATION,
  }),
});

export type AssetTrackerData = z.infer<typeof AssetTrackerDataSchema>;
