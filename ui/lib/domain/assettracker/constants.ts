import type { AccountSummaryView } from "./assetTrackerViews";

export const ACCOUNT_COLORS = [
  "hsl(220, 70%, 50%)",
  "hsl(160, 60%, 45%)",
  "hsl(30, 80%, 55%)",
  "hsl(280, 65%, 55%)",
  "hsl(350, 65%, 55%)",
  "hsl(190, 70%, 45%)",
] as const;

export function formatCurrency(value: number): string {
  return `£${value.toLocaleString()}`;
}

export function computeTotalBalance(accounts: AccountSummaryView[]): number {
  return accounts.reduce((sum, a) => sum + (a.latestBalance ?? 0), 0);
}
