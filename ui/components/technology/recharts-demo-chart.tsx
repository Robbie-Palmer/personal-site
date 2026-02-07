"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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

// Line chart data - monthly performance
const lineData = [
  { month: "Jan", revenue: 4000, expenses: 2400 },
  { month: "Feb", revenue: 3000, expenses: 1398 },
  { month: "Mar", revenue: 2000, expenses: 1800 },
  { month: "Apr", revenue: 2780, expenses: 1908 },
  { month: "May", revenue: 1890, expenses: 2800 },
  { month: "Jun", revenue: 2390, expenses: 2000 },
];

const lineConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  expenses: { label: "Expenses", color: "var(--chart-2)" },
} satisfies ChartConfig;

// Stacked area chart data - market share over time
const areaData = [
  { month: "Jan", mobile: 40, desktop: 35, tablet: 25 },
  { month: "Feb", mobile: 42, desktop: 33, tablet: 25 },
  { month: "Mar", mobile: 45, desktop: 32, tablet: 23 },
  { month: "Apr", mobile: 48, desktop: 30, tablet: 22 },
  { month: "May", mobile: 52, desktop: 28, tablet: 20 },
  { month: "Jun", mobile: 55, desktop: 27, tablet: 18 },
];

const areaConfig = {
  mobile: { label: "Mobile", color: "var(--chart-1)" },
  desktop: { label: "Desktop", color: "var(--chart-2)" },
  tablet: { label: "Tablet", color: "var(--chart-3)" },
} satisfies ChartConfig;

// Bar chart data - quarterly comparison
const barData = [
  { quarter: "Q1", thisYear: 4000, lastYear: 2400 },
  { quarter: "Q2", thisYear: 3000, lastYear: 1398 },
  { quarter: "Q3", thisYear: 2000, lastYear: 3800 },
  { quarter: "Q4", thisYear: 2780, lastYear: 3908 },
];

const barConfig = {
  thisYear: { label: "2024", color: "var(--chart-1)" },
  lastYear: { label: "2023", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function RechartsDemoChart() {
  return (
    <div className="grid gap-6">
      {/* Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Line Chart</CardTitle>
          <CardDescription>
            Monthly revenue vs expenses with smooth curves
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <ChartContainer config={lineConfig} className="aspect-auto w-full">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-revenue)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="var(--color-expenses)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Stacked Area Chart (Percent) */}
      <Card>
        <CardHeader>
          <CardTitle>Stacked Area Chart</CardTitle>
          <CardDescription>
            Device market share trends as percentages
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <ChartContainer config={areaConfig} className="aspect-auto w-full">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={areaData} stackOffset="expand">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis
                  className="text-xs"
                  tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value) => `${Number(value).toFixed(0)}%`}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Area
                  type="monotone"
                  dataKey="mobile"
                  stackId="1"
                  fill="var(--color-mobile)"
                  stroke="var(--color-mobile)"
                />
                <Area
                  type="monotone"
                  dataKey="desktop"
                  stackId="1"
                  fill="var(--color-desktop)"
                  stroke="var(--color-desktop)"
                />
                <Area
                  type="monotone"
                  dataKey="tablet"
                  stackId="1"
                  fill="var(--color-tablet)"
                  stroke="var(--color-tablet)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Bar Chart</CardTitle>
          <CardDescription>Year-over-year quarterly comparison</CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <ChartContainer config={barConfig} className="aspect-auto w-full">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="quarter" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="thisYear"
                  fill="var(--color-thisYear)"
                  radius={4}
                />
                <Bar
                  dataKey="lastYear"
                  fill="var(--color-lastYear)"
                  radius={4}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
