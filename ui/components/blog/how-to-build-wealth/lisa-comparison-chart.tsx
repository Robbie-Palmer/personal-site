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
  { year: 1, invested: 4000, isa: 4000, lisa: 5000, lisaFees: 3750 },
  { year: 2, invested: 8000, isa: 8280, lisa: 10350, lisaFees: 7762.5 },
  { year: 3, invested: 12000, isa: 12859.6, lisa: 16074.5, lisaFees: 12055.88 },
  {
    year: 4,
    invested: 16000,
    isa: 17759.77,
    lisa: 22199.72,
    lisaFees: 16649.79,
  },
  {
    year: 5,
    invested: 20000,
    isa: 23002.96,
    lisa: 28753.7,
    lisaFees: 21565.27,
  },
  {
    year: 6,
    invested: 24000,
    isa: 28613.16,
    lisa: 35766.45,
    lisaFees: 26824.84,
  },
  {
    year: 7,
    invested: 28000,
    isa: 34616.08,
    lisa: 43270.11,
    lisaFees: 32452.58,
  },
  {
    year: 8,
    invested: 32000,
    isa: 41039.21,
    lisa: 51299.01,
    lisaFees: 38474.26,
  },
  {
    year: 9,
    invested: 36000,
    isa: 47911.95,
    lisa: 59889.94,
    lisaFees: 44917.46,
  },
  {
    year: 10,
    invested: 40000,
    isa: 55265.79,
    lisa: 69082.24,
    lisaFees: 51811.68,
  },
  { year: 11, invested: 44000, isa: 63134.4, lisa: 78918.0, lisaFees: 59188.5 },
  {
    year: 12,
    invested: 48000,
    isa: 71553.81,
    lisa: 89442.26,
    lisaFees: 67081.69,
  },
  {
    year: 13,
    invested: 52000,
    isa: 80562.57,
    lisa: 100703.21,
    lisaFees: 75527.41,
  },
  {
    year: 14,
    invested: 56000,
    isa: 90201.95,
    lisa: 112752.44,
    lisaFees: 84564.33,
  },
  {
    year: 15,
    invested: 60000,
    isa: 100516.09,
    lisa: 125645.11,
    lisaFees: 94233.83,
  },
  {
    year: 16,
    invested: 64000,
    isa: 111552.21,
    lisa: 139440.27,
    lisaFees: 104580.2,
  },
  {
    year: 17,
    invested: 68000,
    isa: 123360.87,
    lisa: 154201.09,
    lisaFees: 115650.81,
  },
  {
    year: 18,
    invested: 72000,
    isa: 135996.13,
    lisa: 169995.16,
    lisaFees: 127496.37,
  },
  {
    year: 19,
    invested: 76000,
    isa: 149515.86,
    lisa: 186894.82,
    lisaFees: 140171.12,
  },
  {
    year: 20,
    invested: 80000,
    isa: 163981.97,
    lisa: 204977.46,
    lisaFees: 153733.1,
  },
];

const chartConfig = {
  invested: {
    label: "Total Invested",
    color: "var(--chart-1)",
  },
  isa: {
    label: "Normal ISA Balance",
    color: "var(--chart-2)",
  },
  lisa: {
    label: "LISA",
    color: "var(--chart-3)",
  },
  lisaFees: {
    label: "LISA With Fees",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

export function LisaComparisonChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lifetime ISA vs Normal ISA</CardTitle>
        <CardDescription>
          Investing £4,000 per year over 20 years (7% returns)
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
                dataKey="invested"
                stroke="var(--color-invested)"
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
              <Line
                type="monotone"
                dataKey="lisa"
                stroke="var(--color-lisa)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="lisaFees"
                stroke="var(--color-lisaFees)"
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
