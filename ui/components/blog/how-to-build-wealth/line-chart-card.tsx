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

interface LineConfig {
  dataKey: string;
  strokeDasharray?: string;
}

interface LineChartCardProps {
  title: string;
  description: string;
  chartData: Array<Record<string, any>>;
  chartConfig: ChartConfig;
  xAxisDataKey?: string;
  xAxisLabel?: string;
  yAxisLabel: string;
  lines: LineConfig[];
  yAxisTickFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number) => string;
}

export function LineChartCard({
  title,
  description,
  chartData,
  chartConfig,
  xAxisDataKey = "year",
  xAxisLabel = "Year",
  yAxisLabel,
  lines,
  yAxisTickFormatter,
  tooltipFormatter,
}: LineChartCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
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
                dataKey={xAxisDataKey}
                label={{
                  value: xAxisLabel,
                  position: "insideBottom",
                  offset: -5,
                }}
                className="text-xs"
              />
              <YAxis
                label={{
                  value: yAxisLabel,
                  angle: -90,
                  position: "insideLeft",
                }}
                className="text-xs"
                tickFormatter={yAxisTickFormatter}
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={tooltipFormatter}
              />
              <ChartLegend
                content={<ChartLegendContent />}
                verticalAlign="bottom"
                wrapperStyle={{ paddingTop: "20px" }}
              />
              {lines.map((line) => (
                <Line
                  key={line.dataKey}
                  type="monotone"
                  dataKey={line.dataKey}
                  stroke={`var(--color-${line.dataKey})`}
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray={line.strokeDasharray}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
