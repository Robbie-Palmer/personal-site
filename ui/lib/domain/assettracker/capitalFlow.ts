import { z } from "zod";
import { AccountIdSchema } from "./account";

/**
 * A signed change in the capital contributed to an account since the previous
 * observation. Deposits are positive and withdrawals are negative. Keeping
 * this separate from market value lets the tracker distinguish investment
 * performance from money the user moved in or out.
 */
export const CapitalFlowSchema = z.object({
  accountId: AccountIdSchema,
  date: z.iso.date(),
  amount: z.number(),
});

export type CapitalFlow = z.infer<typeof CapitalFlowSchema>;
