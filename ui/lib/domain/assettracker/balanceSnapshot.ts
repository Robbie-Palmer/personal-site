import { z } from "zod";
import { AccountIdSchema } from "./account";

export const BalanceSnapshotSchema = z.object({
  accountId: AccountIdSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  balance: z.number(),
});

export type BalanceSnapshot = z.infer<typeof BalanceSnapshotSchema>;
