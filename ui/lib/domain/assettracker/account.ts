import { z } from "zod";

export const AccountIdSchema = z.string().min(1);
export type AccountId = z.infer<typeof AccountIdSchema>;

export const AssetTypeSchema = z.enum(["cash", "stocks", "crypto"]);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const CurrencySchema = z.enum(["GBP", "USD"]);
export type Currency = z.infer<typeof CurrencySchema>;

export const AccountContentSchema = z.object({
  id: AccountIdSchema,
  name: z.string().min(1),
  provider: z.string().min(1),
  currency: CurrencySchema,
  assetType: AssetTypeSchema,
  expectedAnnualReturn: z.number(),
  createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  closedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type AccountContent = z.infer<typeof AccountContentSchema>;

export type Account = AccountContent;
