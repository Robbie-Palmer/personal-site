"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const FI_VALUE = 365724.48;

const chartData = [
  { year: 1, uninvested: 10068.95, invested: 10068.95 },
  { year: 2, uninvested: 20137.89, invested: 20842.72 },
  { year: 3, uninvested: 30206.84, invested: 32370.66 },
  { year: 4, uninvested: 40275.79, invested: 44705.55 },
  { year: 5, uninvested: 50344.74, invested: 57903.89 },
  { year: 6, uninvested: 60413.68, invested: 72026.11 },
  { year: 7, uninvested: 70482.63, invested: 87136.88 },
  { year: 8, uninvested: 80551.58, invested: 103305.41 },
  { year: 9, uninvested: 90620.52, invested: 120605.74 },
  { year: 10, uninvested: 100689.47, invested: 139117.09 },
  { year: 11, uninvested: 110758.42, invested: 158924.23 },
  { year: 12, uninvested: 120827.37, invested: 180117.87 },
  { year: 13, uninvested: 130896.31, invested: 202795.07 },
  { year: 14, uninvested: 140965.26, invested: 227059.67 },
  { year: 15, uninvested: 151034.21, invested: 253022.8 },
  { year: 16, uninvested: 161103.16, invested: 280803.34 },
  { year: 17, uninvested: 171172.1, invested: 310528.52 },
  { year: 18, uninvested: 181241.05, invested: 342334.46 },
  { year: 19, uninvested: 191310.0, invested: 376366.82 },
  { year: 20, uninvested: 201378.94, invested: 412781.45 },
  { year: 21, uninvested: 211447.89, invested: 451745.1 },
  { year: 22, uninvested: 221516.84, invested: 493436.2 },
  { year: 23, uninvested: 231585.79, invested: 538045.68 },
  { year: 24, uninvested: 241654.73, invested: 585777.83 },
  { year: 25, uninvested: 251723.68, invested: 636851.22 },
  { year: 26, uninvested: 261792.63, invested: 691499.75 },
  { year: 27, uninvested: 271861.57, invested: 749973.68 },
  { year: 28, uninvested: 281930.52, invested: 812540.79 },
  { year: 29, uninvested: 291999.47, invested: 879487.59 },
  { year: 30, uninvested: 302068.42, invested: 951120.67 },
  { year: 31, uninvested: 312137.36, invested: 1027768.06 },
  { year: 32, uninvested: 322206.31, invested: 1109780.78 },
  { year: 33, uninvested: 332275.26, invested: 1197534.38 },
  { year: 34, uninvested: 342344.2, invested: 1291430.73 },
  { year: 35, uninvested: 352413.15, invested: 1391899.83 },
  { year: 36, uninvested: 362482.1, invested: 1499401.76 },
  { year: 37, uninvested: 372551.05, invested: 1614428.84 },
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
} satisfies ChartConfig;

export function FinancialIndependenceChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Path to Financial Independence</CardTitle>
        <CardDescription>
          Median UK earner saving £10k/year. Horizontal line shows FI target
          (£365,724)
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={chartConfig} className="min-h-[400px] w-full">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="year"
                label={{ value: "Year", position: "insideBottom", offset: -5 }}
                className="text-xs"
              />
              <YAxis
                label={{
                  value: "Balance (£)",
                  angle: -90,
                  position: "insideLeft",
                }}
                className="text-xs"
                tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`}
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value: number) => `£${value.toLocaleString()}`}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <ReferenceLine
                y={FI_VALUE}
                stroke="var(--chart-3)"
                strokeDasharray="3 3"
                label={{
                  value: "Financial Independence",
                  position: "insideTopRight",
                  className: "fill-muted-foreground text-xs",
                }}
              />
              <Line
                type="monotone"
                dataKey="uninvested"
                stroke="var(--color-uninvested)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="invested"
                stroke="var(--color-invested)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
