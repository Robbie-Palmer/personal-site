"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  computeTotalBalance,
  formatAssetTrackerError,
  formatCurrency,
} from "@/lib/domain/assettracker";
import { useAssetTracker } from "./asset-tracker-provider";
import { IncomeHistoryImportDrawer } from "./income-history-import-drawer";

function signedCurrency(value: number): string {
  if (value === 0) return formatCurrency(0);
  return `${value > 0 ? "+" : "−"}${formatCurrency(Math.abs(value))}`;
}

export function PortfolioGoal() {
  const {
    accounts,
    incomeHistory,
    financialIndependence,
    withdrawalRate,
    setWithdrawalRate,
  } = useAssetTracker();
  const [error, setError] = useState<string | null>(null);
  const currentNetWorth = computeTotalBalance(accounts);
  const { periods, representativeAnnualExpenditure, target, progress } =
    financialIndependence;

  async function handleWithdrawalRate(value: string) {
    if (value === "") return;
    const percent = Number(value);
    if (!Number.isFinite(percent)) return;
    try {
      await setWithdrawalRate(percent / 100);
      setError(null);
    } catch (err) {
      setError(formatAssetTrackerError(err));
    }
  }

  return (
    <Card className="min-w-0 lg:col-span-2">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Financial independence</CardTitle>
          <CardDescription>
            Derived from income, complete account balances, and signed capital
            flows—not a manually chosen net-worth goal.
          </CardDescription>
        </div>
        <IncomeHistoryImportDrawer />
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-5 px-4 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">
              Representative annual expenditure
            </p>
            <p className="mt-1 text-xl font-semibold">
              {representativeAnnualExpenditure == null
                ? "—"
                : formatCurrency(Math.round(representativeAnnualExpenditure))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Median annualised period
            </p>
          </div>
          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">FI target</p>
              <label
                htmlFor="withdrawal-rate"
                className="flex items-center gap-1 text-xs text-muted-foreground"
              >
                <span>Withdrawal</span>
                <Input
                  id="withdrawal-rate"
                  aria-label="Withdrawal rate"
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  max="100"
                  step="0.1"
                  className="h-7 w-16 text-right"
                  key={withdrawalRate}
                  defaultValue={(withdrawalRate * 100).toFixed(1)}
                  onBlur={(event) => handleWithdrawalRate(event.target.value)}
                />
                <span>%</span>
              </label>
            </div>
            <p className="mt-1 text-xl font-semibold">
              {target == null ? "—" : formatCurrency(Math.round(target))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Annual expenditure ÷ withdrawal rate
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">FI progress</p>
            <p className="mt-1 text-xl font-semibold">
              {progress == null ? "—" : `${Math.round(progress * 100)}%`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCurrency(currentNetWorth)} total net worth, including all
              home equity
            </p>
          </div>
        </div>

        {progress != null && (
          <progress
            value={progress}
            max={1}
            aria-label="Financial independence progress"
            className="h-2 w-full overflow-hidden rounded-full bg-muted [appearance:none] [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary"
          />
        )}

        {periods.length > 0 ? (
          <div className="min-w-0 space-y-2">
            <div>
              <h3 className="text-sm font-medium">Period reconciliation</h3>
              <p className="text-xs text-muted-foreground">
                Opening net worth + income − expenditure + valuation gain =
                closing net worth. Net capital flow is income retained on the
                balance sheet.
              </p>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Period</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Opening
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Income</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Net flow
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Valuation gain
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Expenditure
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Closing
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((period) => (
                    <tr key={period.endDate} className="border-t">
                      <td className="whitespace-nowrap px-3 py-2">
                        {period.startDate} – {period.endDate}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {formatCurrency(period.openingNetWorth)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {formatCurrency(period.income)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {signedCurrency(period.netCapitalFlow)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {signedCurrency(period.valuationGain)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {formatCurrency(period.expenditure)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {formatCurrency(period.closingNetWorth)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {incomeHistory.length === 0
              ? "Add period income history to derive expenditure and an FI target. Account balances and signed deposits or withdrawals provide the rest of the reconciliation."
              : "Income is saved, but there are not yet two usable balance-sheet dates around an income period. Add complete account balances at matching period ends."}
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
