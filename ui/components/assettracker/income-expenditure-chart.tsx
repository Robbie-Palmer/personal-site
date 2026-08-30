"use client";

import { format, parseISO } from "date-fns";
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  formatAxisTick,
  formatCurrency,
  type IncomeRecord,
  type PortfolioReconciliationPeriod,
} from "@/lib/domain/assettracker";

const INCOME_COLOR = "hsl(220, 70%, 50%)";
const EXPENDITURE_COLOR = "hsl(30, 80%, 55%)";
const DIFFERENCE_COLOR = "hsl(160, 60%, 40%)";

const CHART_CONFIG = {
  income: { label: "Income", color: INCOME_COLOR },
  expenditure: { label: "Expenditure", color: EXPENDITURE_COLOR },
  difference: { label: "Income minus expenditure", color: DIFFERENCE_COLOR },
} satisfies ChartConfig;

type IncomeExpenditurePoint = {
  date: string;
  income: number;
  expenditure?: number;
  difference?: number;
};

export function buildIncomeExpenditureSeries(
  incomeHistory: readonly IncomeRecord[],
  periods: readonly PortfolioReconciliationPeriod[],
): IncomeExpenditurePoint[] {
  const expenditureByDate = new Map(
    periods.map((period) => [period.endDate, period.expenditure]),
  );
  return incomeHistory
    .map((record) => {
      const expenditure = expenditureByDate.get(record.date);
      return {
        date: record.date,
        income: record.amount,
        expenditure,
        difference:
          expenditure == null ? undefined : record.amount - expenditure,
      };
    })
    .toSorted((a, b) => a.date.localeCompare(b.date));
}

export function IncomeExpenditureChart({
  incomeHistory,
  periods,
}: Readonly<{
  incomeHistory: readonly IncomeRecord[];
  periods: readonly PortfolioReconciliationPeriod[];
}>) {
  const [view, setView] = useState<"comparison" | "difference">("comparison");
  const data = buildIncomeExpenditureSeries(incomeHistory, periods);
  if (data.length === 0) return null;

  const hasExpenditure = data.some((point) => point.expenditure != null);

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">Income and expenditure</h3>
          <p className="text-xs text-muted-foreground">
            {view === "comparison"
              ? "Period totals from imported income and reconciled account history."
              : "Income minus expenditure. Values above zero were retained; values below zero were funded from existing wealth."}
            {!hasExpenditure &&
              " Expenditure will appear when matching balance-sheet periods are available."}
          </p>
        </div>
        <fieldset className="flex gap-1">
          <legend className="sr-only">Income and expenditure chart view</legend>
          <Button
            type="button"
            size="sm"
            variant={view === "comparison" ? "secondary" : "ghost"}
            onClick={() => setView("comparison")}
          >
            Compare
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "difference" ? "secondary" : "ghost"}
            disabled={!hasExpenditure}
            onClick={() => setView("difference")}
          >
            Difference
          </Button>
        </fieldset>
      </div>
      <ChartContainer
        config={CHART_CONFIG}
        className="aspect-auto w-full"
        role="img"
        aria-label={
          view === "comparison"
            ? "Income and expenditure by period"
            : "Income minus expenditure by period"
        }
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={data}
            margin={{ top: 10, right: 18, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              className="text-xs"
              minTickGap={24}
              tickFormatter={(date: string) => format(parseISO(date), "MMM yy")}
            />
            <YAxis
              className="text-xs"
              width={48}
              tickFormatter={(value: number) => `£${formatAxisTick(value)}`}
            />
            <ReferenceLine y={0} className="stroke-muted-foreground" />
            <ChartTooltip
              content={<ChartTooltipContent />}
              formatter={(value) => formatCurrency(value as number)}
            />
            {view === "comparison" ? (
              <>
                <Line
                  type="monotone"
                  dataKey="income"
                  name="Income"
                  stroke={INCOME_COLOR}
                  strokeWidth={2.5}
                  dot={data.length === 1}
                  connectNulls
                />
                {hasExpenditure && (
                  <Line
                    type="monotone"
                    dataKey="expenditure"
                    name="Expenditure"
                    stroke={EXPENDITURE_COLOR}
                    strokeWidth={2.5}
                    dot={periods.length === 1}
                    connectNulls={false}
                  />
                )}
              </>
            ) : (
              <Line
                type="monotone"
                dataKey="difference"
                name="Income minus expenditure"
                stroke={DIFFERENCE_COLOR}
                strokeWidth={2.5}
                dot={periods.length === 1}
                connectNulls={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        {view === "comparison" ? (
          <>
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ backgroundColor: INCOME_COLOR }}
              />
              Income
            </span>
            {hasExpenditure && (
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: EXPENDITURE_COLOR }}
                />
                Expenditure
              </span>
            )}
          </>
        ) : (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ backgroundColor: DIFFERENCE_COLOR }}
            />
            Income minus expenditure
          </span>
        )}
      </div>
      <table className="sr-only">
        <caption>Income and expenditure by period</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Income</th>
            <th>Expenditure</th>
            <th>Difference</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.date}>
              <td>{point.date}</td>
              <td>{formatCurrency(point.income)}</td>
              <td>
                {point.expenditure == null
                  ? "Awaiting reconciliation"
                  : formatCurrency(point.expenditure)}
              </td>
              <td>
                {point.difference == null
                  ? "Awaiting reconciliation"
                  : formatCurrency(point.difference)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
