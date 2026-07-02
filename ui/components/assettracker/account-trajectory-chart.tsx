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
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  type AccountDetailView,
  buildExpectedTrajectory,
  formatAccountCurrency,
  formatAxisTick,
  isLiability,
} from "@/lib/domain/assettracker";
import { useAssetTracker } from "./asset-tracker-provider";

const ASSET_COPY = {
  title: "Actual vs expected growth",
  description:
    "Expected compounds the first balance at the expected return and steps with recorded transfers, so the remaining gap is pure out/under-performance.",
  config: {
    actual: { label: "Actual", color: "hsl(220, 70%, 50%)" },
    expected: { label: "Expected", color: "hsl(220, 10%, 60%)" },
  } satisfies ChartConfig,
};

const LIABILITY_COPY = {
  title: "Actual vs interest-only",
  description:
    "Expected compounds the opening balance at the interest rate alone — so the gap above it is the effect of your repayments.",
  config: {
    actual: { label: "Actual", color: "hsl(220, 70%, 50%)" },
    expected: { label: "Interest only", color: "hsl(220, 10%, 60%)" },
  } satisfies ChartConfig,
};

interface AccountTrajectoryChartProps {
  account: AccountDetailView;
}

export function AccountTrajectoryChart({
  account,
}: AccountTrajectoryChartProps) {
  const { transfers } = useAssetTracker();
  const externalFlows = transfers
    .filter(
      (t) => t.fromAccountId === account.id || t.toAccountId === account.id,
    )
    .map((t) => ({
      date: t.date,
      amount: t.toAccountId === account.id ? t.amount : -t.amount,
    }));
  const trajectory = buildExpectedTrajectory(
    account,
    account.snapshots,
    externalFlows,
  );
  if (trajectory.length < 2) return null;

  const copy = isLiability(account.assetType) ? LIABILITY_COPY : ASSET_COPY;

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">{copy.title}</h3>
      <p className="mb-2 text-xs text-muted-foreground">{copy.description}</p>
      <ChartContainer config={copy.config} className="aspect-auto w-full">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart
            data={trajectory}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" className="text-xs" hide />
            <YAxis
              className="text-xs"
              width={45}
              tickFormatter={formatAxisTick}
            />
            <ChartTooltip
              content={<ChartTooltipContent />}
              formatter={(value) =>
                formatAccountCurrency(value as number, account.currency)
              }
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="hsl(220, 70%, 50%)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="expected"
              stroke="hsl(220, 10%, 60%)"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
