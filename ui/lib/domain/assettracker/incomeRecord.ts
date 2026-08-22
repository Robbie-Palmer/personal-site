import { z } from "zod";

/**
 * Income received across the portfolio during the period ending on `date`.
 * This is deliberately portfolio-level: allocating salary to an account would
 * make internal transfers part of income and break the balance-sheet
 * reconciliation.
 */
export const IncomeRecordSchema = z.object({
  date: z.iso.date(),
  amount: z.number().nonnegative("Income cannot be negative"),
});

export type IncomeRecord = z.infer<typeof IncomeRecordSchema>;
