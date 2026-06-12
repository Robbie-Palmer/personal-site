import { z } from "zod";
import { AccountIdSchema } from "./account";

/**
 * A movement of money on a single date. Either side may be external:
 * income has no source account, spending has no destination account.
 * Transfers don't replace balance snapshots — recording one derives new
 * snapshots on the affected accounts so the charts stay truthful.
 */
export const TransferSchema = z
  .object({
    id: z.string().min(1),
    date: z.iso.date(),
    fromAccountId: AccountIdSchema.optional(),
    toAccountId: AccountIdSchema.optional(),
    amount: z.number().positive("Amount must be positive"),
  })
  .refine((t) => t.fromAccountId != null || t.toAccountId != null, {
    message: "A transfer needs a source or a destination account",
  })
  .refine((t) => t.fromAccountId !== t.toAccountId, {
    message: "Source and destination must differ",
  });

export type Transfer = z.infer<typeof TransferSchema>;
