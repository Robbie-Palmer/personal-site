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
  { year: 5, uninvested: 50344.74, invested: 57903.89 },
  { year: 10, uninvested: 100689.47, invested: 139117.09 },
  { year: 15, uninvested: 151034.21, invested: 253022.8 },
  { year: 18, uninvested: 181241.05, invested: 342334.46 },
  { year: 19, uninvested: 191310.0, invested: 376366.82 },
  { year: 20, uninvested: 201378.94, invested: 412781.45 },
  { year: 25, uninvested: 251723.68, invested: 636851.22 },
  { year: 30, uninvested: 302068.42, invested: 951120.67 },
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
      <CardContent>
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
                stroke="hsl(var(--chart-3))"
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
