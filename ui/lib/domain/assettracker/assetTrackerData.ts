import { z } from "zod";
import { AccountContentSchema } from "./account";
import { BalanceSnapshotSchema } from "./balanceSnapshot";

/**
 * The full serializable state of a user's tracker. This is the unit of
 * persistence: today it round-trips through browser storage and JSON
 * export/import; a future backend persists the same shape in D1.
 */
export const AssetTrackerDataSchema = z.object({
  accounts: z.array(AccountContentSchema),
  snapshots: z.array(BalanceSnapshotSchema),
});

export type AssetTrackerData = z.infer<typeof AssetTrackerDataSchema>;
