import { z } from "zod";

export const AccountIdSchema = z.string().min(1);
export type AccountId = z.infer<typeof AccountIdSchema>;

export const AssetTypeSchema = z.enum([
  "cash",
  "stocks",
  "bonds",
  "reits",
  "crypto",
  "property",
  "mortgage",
  "debt",
]);
export type AssetType = z.infer<typeof AssetTypeSchema>;

/** Liabilities carry negative balances; their rate is the interest charged */
export function isLiability(assetType: AssetType): boolean {
  return assetType === "mortgage" || assetType === "debt";
}

export const CurrencySchema = z.enum(["GBP", "USD"]);
export type Currency = z.infer<typeof CurrencySchema>;

/**
 * A change to the expected annual return from a given date, e.g. a savings
 * rate cut or a mortgage fix expiring. The account's base
 * expectedAnnualReturn applies before the first change.
 */
export const ExpectedReturnChangeSchema = z.object({
  date: z.iso.date(),
  rate: z.number().gt(-1, "Rate must be above -100%"),
});
export type ExpectedReturnChange = z.infer<typeof ExpectedReturnChangeSchema>;

export const AccountContentSchema = z.object({
  id: AccountIdSchema,
  name: z.string().min(1),
  provider: z.string().min(1),
  currency: CurrencySchema,
  assetType: AssetTypeSchema,
  // For debt accounts this is the interest rate, compounding the (negative)
  // balance further from zero
  expectedAnnualReturn: z.number(),
  expectedReturnChanges: z.array(ExpectedReturnChangeSchema).optional(),
  /**
   * Inter-linked accounts, e.g. a mortgage secured on a property. Lets the
   * tracker derive figures like home equity (property value + mortgage
   * balance) without the user maintaining them.
   */
  linkedAccountId: AccountIdSchema.optional(),
  createdAt: z.iso.date(),
  closedAt: z.iso.date().optional(),
});

export type AccountContent = z.infer<typeof AccountContentSchema>;

export type Account = AccountContent;

/** The expected annual return in force on a given date */
export function effectiveExpectedReturn(
  account: Pick<Account, "expectedAnnualReturn" | "expectedReturnChanges">,
  date: string,
): number {
  const applied = (account.expectedReturnChanges ?? [])
    .filter((change) => change.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date));
  return applied[applied.length - 1]?.rate ?? account.expectedAnnualReturn;
}
