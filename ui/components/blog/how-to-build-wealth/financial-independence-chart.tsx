"use client";

import type { ChartConfig } from "@/components/ui/chart";
import { LineChartCard } from "./line-chart-card";

const FI_VALUE = 365724.48;

const chartData = [
  { year: 1, uninvested: 10068.95, invested: 10068.95, fiTarget: FI_VALUE },
  { year: 2, uninvested: 20137.89, invested: 20842.72, fiTarget: FI_VALUE },
  { year: 3, uninvested: 30206.84, invested: 32370.66, fiTarget: FI_VALUE },
  { year: 4, uninvested: 40275.79, invested: 44705.55, fiTarget: FI_VALUE },
  { year: 5, uninvested: 50344.74, invested: 57903.89, fiTarget: FI_VALUE },
  { year: 6, uninvested: 60413.68, invested: 72026.11, fiTarget: FI_VALUE },
  { year: 7, uninvested: 70482.63, invested: 87136.88, fiTarget: FI_VALUE },
  { year: 8, uninvested: 80551.58, invested: 103305.41, fiTarget: FI_VALUE },
  { year: 9, uninvested: 90620.52, invested: 120605.74, fiTarget: FI_VALUE },
  { year: 10, uninvested: 100689.47, invested: 139117.09, fiTarget: FI_VALUE },
  { year: 11, uninvested: 110758.42, invested: 158924.23, fiTarget: FI_VALUE },
  { year: 12, uninvested: 120827.37, invested: 180117.87, fiTarget: FI_VALUE },
  { year: 13, uninvested: 130896.31, invested: 202795.07, fiTarget: FI_VALUE },
  { year: 14, uninvested: 140965.26, invested: 227059.67, fiTarget: FI_VALUE },
  { year: 15, uninvested: 151034.21, invested: 253022.8, fiTarget: FI_VALUE },
  { year: 16, uninvested: 161103.16, invested: 280803.34, fiTarget: FI_VALUE },
  { year: 17, uninvested: 171172.1, invested: 310528.52, fiTarget: FI_VALUE },
  { year: 18, uninvested: 181241.05, invested: 342334.46, fiTarget: FI_VALUE },
  { year: 19, uninvested: 191310.0, invested: 376366.82, fiTarget: FI_VALUE },
  { year: 20, uninvested: 201378.94, invested: 412781.45, fiTarget: FI_VALUE },
  { year: 21, uninvested: 211447.89, invested: 451745.1, fiTarget: FI_VALUE },
  { year: 22, uninvested: 221516.84, invested: 493436.2, fiTarget: FI_VALUE },
  { year: 23, uninvested: 231585.79, invested: 538045.68, fiTarget: FI_VALUE },
  { year: 24, uninvested: 241654.73, invested: 585777.83, fiTarget: FI_VALUE },
  { year: 25, uninvested: 251723.68, invested: 636851.22, fiTarget: FI_VALUE },
  { year: 26, uninvested: 261792.63, invested: 691499.75, fiTarget: FI_VALUE },
  { year: 27, uninvested: 271861.57, invested: 749973.68, fiTarget: FI_VALUE },
  { year: 28, uninvested: 281930.52, invested: 812540.79, fiTarget: FI_VALUE },
  { year: 29, uninvested: 291999.47, invested: 879487.59, fiTarget: FI_VALUE },
  { year: 30, uninvested: 302068.42, invested: 951120.67, fiTarget: FI_VALUE },
  { year: 31, uninvested: 312137.36, invested: 1027768.06, fiTarget: FI_VALUE },
  { year: 32, uninvested: 322206.31, invested: 1109780.78, fiTarget: FI_VALUE },
  { year: 33, uninvested: 332275.26, invested: 1197534.38, fiTarget: FI_VALUE },
  { year: 34, uninvested: 342344.2, invested: 1291430.73, fiTarget: FI_VALUE },
  { year: 35, uninvested: 352413.15, invested: 1391899.83, fiTarget: FI_VALUE },
  { year: 36, uninvested: 362482.1, invested: 1499401.76, fiTarget: FI_VALUE },
  { year: 37, uninvested: 372551.05, invested: 1614428.84, fiTarget: FI_VALUE },
];

const chartConfig = {
  uninvested: {
    label: "Uninvested",
    color: "var(--chart-1)",
  },
  invested: {
    label: "Invested",
    color: "var(--chart-2)",
  },
  fiTarget: {
    label: "FI Target",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

export function FinancialIndependenceChart() {
  return (
    <LineChartCard
      title="Path to Financial Independence"
      description="Median UK earner saving £10k/year. Horizontal line shows FI target (£365,724)"
      chartData={chartData}
      chartConfig={chartConfig}
      yAxisLabel="Balance (£)"
      yAxisTickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`}
      tooltipFormatter={(value) =>
        value !== undefined ? `£${value.toLocaleString()}` : ""
      }
      lines={[
        { dataKey: "uninvested" },
        { dataKey: "invested" },
        { dataKey: "fiTarget", strokeDasharray: "5 5" },
      ]}
    />
  );
}
