"use client";
import { Bar, BarChart, Cell, ReferenceLine, XAxis, YAxis } from "recharts";
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
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { AssetType } from "@/lib/domain/assettracker";
import {
  ASSET_TYPE_COLORS,
  ASSET_TYPE_LABELS,
  formatCurrency,
} from "@/lib/domain/assettracker";

interface AssetAllocationChartProps {
  data: { assetType: AssetType; total: number }[];
}

export function AssetAllocationChart({ data }: AssetAllocationChartProps) {
  // Largest magnitude first so assets and liabilities read top-to-bottom
  const chartData = [...data]
    .filter((item) => item.total !== 0)
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
    .map((item) => ({
      label: ASSET_TYPE_LABELS[item.assetType],
      value: item.total,
      assetType: item.assetType,
    }));

  const chartConfig: ChartConfig = { value: { label: "Net value" } };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net Worth Composition</CardTitle>
        <CardDescription>
          Assets above the line, liabilities below. Mortgages are netted into
          the property they're secured on, so property shows as equity.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={chartConfig} className="aspect-auto w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            height={300}
            margin={{ top: 5, right: 16, left: 8, bottom: 5 }}
          >
            <XAxis
              type="number"
              className="text-xs"
              tickFormatter={(v: number) => `£${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              type="category"
              dataKey="label"
              className="text-xs"
              width={70}
            />
            <ReferenceLine x={0} className="stroke-muted-foreground" />
            <ChartTooltip
              content={<ChartTooltipContent />}
              formatter={(value) => formatCurrency(value as number)}
            />
            <Bar dataKey="value" radius={4}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.assetType}
                  fill={ASSET_TYPE_COLORS[entry.assetType]}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
