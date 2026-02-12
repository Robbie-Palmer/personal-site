"use client";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
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
import type { AssetType } from "@/lib/domain/assettracker";
import { formatCurrency } from "@/lib/domain/assettracker";

const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  cash: "hsl(220, 70%, 50%)",
  stocks: "hsl(160, 60%, 45%)",
  crypto: "hsl(30, 80%, 55%)",
};

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  cash: "Cash",
  stocks: "Stocks",
  crypto: "Crypto",
};

interface AssetAllocationChartProps {
  data: { assetType: AssetType; total: number }[];
}

export function AssetAllocationChart({ data }: AssetAllocationChartProps) {
  const chartConfig: ChartConfig = {};
  for (const item of data) {
    chartConfig[item.assetType] = {
      label: ASSET_TYPE_LABELS[item.assetType],
      color: ASSET_TYPE_COLORS[item.assetType],
    };
  }
  const chartData = data.map((item) => ({
    name: ASSET_TYPE_LABELS[item.assetType],
    value: item.total,
    dataKey: item.assetType,
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset Allocation</CardTitle>
        <CardDescription>
          Breakdown of current holdings by asset type
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={chartConfig} className="aspect-auto w-full">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.dataKey}
                    fill={ASSET_TYPE_COLORS[entry.dataKey as AssetType]}
                  />
                ))}
              </Pie>
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value) => formatCurrency(value as number)}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
