"use client";

import dynamic from "next/dynamic";

function ChartLoading() {
  return (
    <div className="flex min-h-64 w-full items-center justify-center rounded-lg bg-muted">
      <p className="text-sm text-muted-foreground">Loading chart...</p>
    </div>
  );
}

export const DebtInvestmentChart = dynamic(
  () =>
    import("./debt-investment-chart").then((mod) => mod.DebtInvestmentChart),
  { ssr: false, loading: ChartLoading },
);

export const FinancialIndependenceChart = dynamic(
  () =>
    import("./financial-independence-chart").then(
      (mod) => mod.FinancialIndependenceChart,
    ),
  { ssr: false, loading: ChartLoading },
);

export const LisaComparisonChart = dynamic(
  () =>
    import("./lisa-comparison-chart").then((mod) => mod.LisaComparisonChart),
  { ssr: false, loading: ChartLoading },
);

export const PensionReturnsChart = dynamic(
  () =>
    import("./pension-returns-chart").then((mod) => mod.PensionReturnsChart),
  { ssr: false, loading: ChartLoading },
);
