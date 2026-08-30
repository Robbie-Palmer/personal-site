"use client";

import { format, parseISO } from "date-fns";
import { useEffect, useState } from "react";
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
  FI_PROJECTION_MAX_YEARS,
  formatAssetTrackerError,
  formatCurrency,
} from "@/lib/domain/assettracker";
import { useAssetTracker } from "./asset-tracker-provider";
import { IncomeExpenditureChart } from "./income-expenditure-chart";
import { IncomeHistoryImportDrawer } from "./income-history-import-drawer";
import { PortfolioFiProjectionChart } from "./portfolio-fi-projection-chart";

function signedCurrency(value: number): string {
  if (value === 0) return formatCurrency(0);
  return `${value > 0 ? "+" : "−"}${formatCurrency(Math.abs(value))}`;
}

function optionalCurrency(value: number | null): string {
  return value == null ? "—" : formatCurrency(Math.round(value));
}

function percentage(value: number | null, fractionDigits = 0): string {
  return value == null ? "—" : `${(value * 100).toFixed(fractionDigits)}%`;
}

function getYearsToFiLabel(
  yearsToFi: number | null,
  hasProjection: boolean,
): string {
  if (yearsToFi === 0) return "Reached";
  if (yearsToFi != null) return `${yearsToFi.toFixed(1)} years`;
  if (hasProjection) return `>${FI_PROJECTION_MAX_YEARS} years`;
  return "—";
}

function getAnnualSavingsDescription(annualSavings: number | null): string {
  if (annualSavings == null) return "Income retained ÷ income";
  return `${formatCurrency(Math.round(annualSavings))}/yr median retained`;
}

function getEmergencyFundDescription(months: number | null): string {
  if (months == null) return "Add reconciled spending to calculate runway";
  return `${months.toFixed(1)} months without income`;
}

function getProjectedFiDescription({
  projectedFiDate,
  target,
  yearsToFi,
}: {
  projectedFiDate: string | null;
  target: number | null;
  yearsToFi: number | null;
}): string {
  if (projectedFiDate != null) {
    if (yearsToFi === 0) return "Current net worth already meets the target";
    return `Around ${format(parseISO(projectedFiDate), "MMM yyyy")}`;
  }
  if (target == null) return "Needs reconciled income and expenditure";
  return "At current real return and savings";
}

function getEmptyReconciliationDescription(hasIncome: boolean): string {
  if (!hasIncome) {
    return "Add period income history to derive expenditure and an FI target. Account balances and signed deposits or withdrawals provide the rest of the reconciliation.";
  }
  return "Income is saved, but there are not yet two usable balance-sheet dates around an income period. Add complete account balances at matching period ends.";
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
  const [withdrawalRateDraft, setWithdrawalRateDraft] = useState(() =>
    String(withdrawalRate * 100),
  );
  const currentNetWorth = computeTotalBalance(accounts);
  const {
    periods,
    representativeAnnualExpenditure,
    representativeAnnualSavings,
    savingsRate,
    emergencyFund,
    emergencyFundMonths,
    target,
    progress,
    expectedRealReturn,
    projection,
    projectedFiDate,
    yearsToFi,
  } = financialIndependence;

  const yearsToFiLabel = getYearsToFiLabel(yearsToFi, projection.length > 0);
  const projectedFiDescription = getProjectedFiDescription({
    projectedFiDate,
    target,
    yearsToFi,
  });
  const emptyReconciliationDescription = getEmptyReconciliationDescription(
    incomeHistory.length > 0,
  );

  useEffect(() => {
    setWithdrawalRateDraft(String(withdrawalRate * 100));
  }, [withdrawalRate]);

  async function handleWithdrawalRate(value: string) {
    const percent = Number(value);
    if (!Number.isFinite(percent) || percent < 0.1 || percent > 100) {
      setError("Withdrawal rate must be between 0.1% and 100%");
      return;
    }
    const rate = percent / 100;
    if (rate === withdrawalRate) return;
    try {
      await setWithdrawalRate(rate);
      setError(null);
    } catch (err) {
      setError(formatAssetTrackerError(err));
    }
  }

  return (
    <Card className="min-w-0">
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">
              Representative annual expenditure
            </p>
            <p className="mt-1 text-xl font-semibold">
              {optionalCurrency(representativeAnnualExpenditure)}
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
                  step="any"
                  className="h-7 w-16 text-right"
                  value={withdrawalRateDraft}
                  onChange={(event) => {
                    setWithdrawalRateDraft(event.target.value);
                    setError(null);
                  }}
                  onBlur={(event) => handleWithdrawalRate(event.target.value)}
                />
                <span>%</span>
              </label>
            </div>
            <p className="mt-1 text-xl font-semibold">
              {optionalCurrency(target)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Annual expenditure ÷ withdrawal rate
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">FI progress</p>
            <p className="mt-1 text-xl font-semibold">{percentage(progress)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCurrency(currentNetWorth)} total net worth, including all
              home equity
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Savings rate</p>
            <p className="mt-1 text-xl font-semibold">
              {percentage(savingsRate, 1)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {getAnnualSavingsDescription(representativeAnnualSavings)}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Emergency fund</p>
            <p className="mt-1 text-xl font-semibold">
              {formatCurrency(Math.round(emergencyFund))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {getEmergencyFundDescription(emergencyFundMonths)}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Projected FI</p>
            <p className="mt-1 text-xl font-semibold">{yearsToFiLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {projectedFiDescription}
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

        <IncomeExpenditureChart
          incomeHistory={incomeHistory}
          periods={periods}
        />

        {target != null &&
          representativeAnnualSavings != null &&
          expectedRealReturn != null && (
            <PortfolioFiProjectionChart
              projection={projection}
              target={target}
              annualSavings={representativeAnnualSavings}
              expectedRealReturn={expectedRealReturn}
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
            {emptyReconciliationDescription}
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
