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
  { year: 1, creditCard: 1190.0, savings: 1012.0, investment: 1070.0 },
  { year: 2, creditCard: 1416.1, savings: 1024.144, investment: 1144.9 },
  { year: 3, creditCard: 1685.16, savings: 1036.43, investment: 1225.04 },
  { year: 4, creditCard: 2005.34, savings: 1048.87, investment: 1310.8 },
  { year: 5, creditCard: 2386.35, savings: 1061.46, investment: 1402.55 },
  { year: 6, creditCard: 2839.76, savings: 1074.19, investment: 1500.73 },
  { year: 7, creditCard: 3379.32, savings: 1087.09, investment: 1605.78 },
  { year: 8, creditCard: 4021.39, savings: 1100.13, investment: 1718.19 },
  { year: 9, creditCard: 4785.45, savings: 1113.33, investment: 1838.46 },
  { year: 10, creditCard: 5694.68, savings: 1126.69, investment: 1967.15 },
  { year: 11, creditCard: 6776.67, savings: 1140.21, investment: 2104.85 },
  { year: 12, creditCard: 8064.24, savings: 1153.89, investment: 2252.19 },
  { year: 13, creditCard: 9596.45, savings: 1167.74, investment: 2409.85 },
  { year: 14, creditCard: 11419.77, savings: 1181.75, investment: 2578.53 },
  { year: 15, creditCard: 13589.53, savings: 1195.94, investment: 2759.03 },
  { year: 16, creditCard: 16171.54, savings: 1210.29, investment: 2952.16 },
  { year: 17, creditCard: 19244.13, savings: 1224.81, investment: 3158.82 },
  { year: 18, creditCard: 22900.52, savings: 1239.51, investment: 3379.93 },
  { year: 19, creditCard: 27251.62, savings: 1254.38, investment: 3616.53 },
  { year: 20, creditCard: 32429.42, savings: 1269.43, investment: 3869.68 },
];

const chartConfig = {
  creditCard: {
    label: "Credit Card",
    color: "var(--chart-1)",
  },
  savings: {
    label: "Savings Account",
    color: "var(--chart-2)",
  },
  investment: {
    label: "Investment",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

export function DebtInvestmentChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>£1,000 Over 20 Years</CardTitle>
        <CardDescription>
          Comparing debt (19% interest), savings (1.2% interest), and investment
          (7% returns)
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
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line
                type="monotone"
                dataKey="creditCard"
                stroke="var(--color-creditCard)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="savings"
                stroke="var(--color-savings)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="investment"
                stroke="var(--color-investment)"
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
