import { z } from "zod";
import { AccountIdSchema } from "./account";

export const FlowFrequencySchema = z.enum([
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
]);
export type FlowFrequency = z.infer<typeof FlowFrequencySchema>;

/**
 * A computed payment instead of a fixed amount. Credit card minimum
 * payments are the canonical case: a percentage of the outstanding balance
 * with a floor (e.g. greater of 2.5% or £25), never more than clears it.
 */
export const MinimumPaymentFormulaSchema = z.object({
  kind: z.literal("minimumPayment"),
  percentOfBalance: z
    .number()
    .positive("Percentage must be positive")
    .lt(1, "Use a fraction, e.g. 0.025 for 2.5%"),
  floor: z.number().nonnegative(),
});
export type MinimumPaymentFormula = z.infer<typeof MinimumPaymentFormulaSchema>;

/**
 * An expected regular movement of money: salary landing in an account,
 * a standing order into savings, a loan repayment. Flows feed projections;
 * they never alter recorded balances — reality stays whatever the user logs.
 */
export const RecurringFlowSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1, "Give the flow a name"),
    fromAccountId: AccountIdSchema.optional(),
    toAccountId: AccountIdSchema.optional(),
    amount: z.number().positive("Amount must be positive").optional(),
    /** Computed against the balance of the liability the flow pays down */
    formula: MinimumPaymentFormulaSchema.optional(),
    frequency: FlowFrequencySchema,
    startDate: z.iso.date(),
    endDate: z.iso.date().optional(),
  })
  .refine((f) => f.fromAccountId != null || f.toAccountId != null, {
    message: "A flow needs a source or a destination account",
  })
  .refine((f) => f.fromAccountId !== f.toAccountId, {
    message: "Source and destination must differ",
  })
  .refine((f) => f.amount != null || f.formula != null, {
    message: "A flow needs an amount or a formula",
  });

export type RecurringFlow = z.infer<typeof RecurringFlowSchema>;

const MONTHS_PER_PERIOD: Record<FlowFrequency, number> = {
  weekly: 12 / 52,
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

/**
 * The flow's monthly-equivalent amount. Formula flows are evaluated against
 * the balance of the liability they pay down (`liabilityBalance`); a paid-off
 * or positive balance means no payment is due.
 */
export function monthlyAmount(
  flow: RecurringFlow,
  liabilityBalance?: number,
): number {
  if (flow.formula != null) {
    const owed = liabilityBalance != null ? Math.max(-liabilityBalance, 0) : 0;
    if (owed === 0) return 0;
    return Math.min(
      Math.max(owed * flow.formula.percentOfBalance, flow.formula.floor),
      owed,
    );
  }
  return (flow.amount ?? 0) / MONTHS_PER_PERIOD[flow.frequency];
}
