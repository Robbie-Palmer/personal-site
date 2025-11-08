"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
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

const chartData = [
  { year: 1, pensionEmployer: 100.0, pensionEmployee: 25.0, isa: 0.0 },
  { year: 2, pensionEmployer: 107.0, pensionEmployee: 29.38, isa: 3.5 },
  { year: 3, pensionEmployer: 114.33, pensionEmployee: 33.95, isa: 7.16 },
  { year: 4, pensionEmployer: 122.0, pensionEmployee: 38.75, isa: 11.0 },
  { year: 5, pensionEmployer: 130.03, pensionEmployee: 43.77, isa: 15.01 },
  { year: 6, pensionEmployer: 138.44, pensionEmployee: 49.03, isa: 19.22 },
  { year: 7, pensionEmployer: 147.26, pensionEmployee: 54.54, isa: 23.63 },
  { year: 8, pensionEmployer: 156.5, pensionEmployee: 60.31, isa: 28.25 },
  { year: 9, pensionEmployer: 166.18, pensionEmployee: 66.36, isa: 33.09 },
  { year: 10, pensionEmployer: 176.33, pensionEmployee: 72.71, isa: 38.16 },
  { year: 11, pensionEmployer: 186.97, pensionEmployee: 79.36, isa: 43.49 },
  { year: 12, pensionEmployer: 198.14, pensionEmployee: 86.34, isa: 49.07 },
  { year: 13, pensionEmployer: 209.86, pensionEmployee: 93.66, isa: 54.93 },
  { year: 14, pensionEmployer: 222.15, pensionEmployee: 101.34, isa: 61.07 },
  { year: 15, pensionEmployer: 235.05, pensionEmployee: 109.41, isa: 67.53 },
  { year: 16, pensionEmployer: 248.6, pensionEmployee: 117.88, isa: 74.3 },
  { year: 17, pensionEmployer: 262.83, pensionEmployee: 126.77, isa: 81.41 },
  { year: 18, pensionEmployer: 277.77, pensionEmployee: 136.1, isa: 88.88 },
  { year: 19, pensionEmployer: 293.46, pensionEmployee: 145.91, isa: 96.73 },
  { year: 20, pensionEmployer: 309.95, pensionEmployee: 156.22, isa: 104.98 },
];

const chartConfig = {
  pensionEmployer: {
    label: "Pension (Employer Contribution)",
    color: "var(--chart-1)",
  },
  pensionEmployee: {
    label: "Pension (Employee Only)",
    color: "var(--chart-2)",
  },
  isa: {
    label: "ISA (After Tax)",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

export function PensionReturnsChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Total Return on Investment (%)</CardTitle>
        <CardDescription>
          Comparing pension with employer contributions, pension without, and
          ISA investments
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={chartConfig} className="aspect-auto w-full">
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
                  value: "Total Return (%)",
                  angle: -90,
                  position: "insideLeft",
                }}
                className="text-xs"
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend
                content={<ChartLegendContent />}
                verticalAlign="bottom"
                wrapperStyle={{ paddingTop: "20px" }}
              />
              <Line
                type="monotone"
                dataKey="pensionEmployer"
                stroke="var(--color-pensionEmployer)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="pensionEmployee"
                stroke="var(--color-pensionEmployee)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="isa"
                stroke="var(--color-isa)"
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
