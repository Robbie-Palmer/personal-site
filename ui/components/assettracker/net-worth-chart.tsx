"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
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
import type { NetWorthDataPoint } from "@/lib/api/assettracker";

const ACCOUNT_COLORS = [
  "hsl(220, 70%, 50%)",
  "hsl(160, 60%, 45%)",
  "hsl(30, 80%, 55%)",
  "hsl(280, 65%, 55%)",
  "hsl(350, 65%, 55%)",
  "hsl(190, 70%, 45%)",
];

function formatCurrency(value: number): string {
  return `£${value.toLocaleString()}`;
}

interface NetWorthChartProps {
  data: NetWorthDataPoint[];
  accountNames: string[];
}

export function NetWorthChart({ data, accountNames }: NetWorthChartProps) {
  const chartConfig: ChartConfig = {};
  for (const [i, name] of accountNames.entries()) {
    chartConfig[name] = {
      label: name,
      color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
    };
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Net Worth Over Time</CardTitle>
        <CardDescription>
          Stacked area chart showing balance across all accounts
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={chartConfig} className="aspect-auto w-full">
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart
              data={data}
              margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis
                className="text-xs"
                tickFormatter={(v: number) => `£${(v / 1000).toFixed(0)}k`}
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value) => formatCurrency(value as number)}
              />
              <ChartLegend
                content={<ChartLegendContent />}
                verticalAlign="bottom"
                wrapperStyle={{ paddingTop: "20px" }}
              />
              {accountNames.map((name, i) => (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stackId="1"
                  stroke={ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]}
                  fill={ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]}
                  fillOpacity={0.3}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
