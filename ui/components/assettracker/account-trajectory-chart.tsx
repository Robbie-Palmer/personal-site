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
  buildAccountHistorySeries,
  formatAccountCurrency,
  formatAxisTick,
  isLiability,
  selectAccountExternalFlows,
} from "@/lib/domain/assettracker";
import { useAssetTracker } from "./asset-tracker-provider";

const ASSET_COPY = {
  title: "Actual vs expected growth",
  description:
    "Actual uses logged market values. Expected compounds the first balance and adjusts for deposits and withdrawals; net contributed shows the exact capital history.",
  config: {
    actual: { label: "Actual", color: "hsl(220, 70%, 50%)" },
    expected: { label: "Expected", color: "hsl(220, 10%, 60%)" },
    contributed: { label: "Net contributed", color: "hsl(150, 55%, 42%)" },
  } satisfies ChartConfig,
};

const CONTRIBUTION_COPY = {
  title: "Contribution history",
  description:
    "Net contributed is exact and steps with each deposit or withdrawal. Market value appears only on dates where a balance was logged.",
  config: ASSET_COPY.config,
};

const LIABILITY_COPY = {
  title: "Actual vs interest-only",
  description:
    "Expected compounds the opening balance at the interest rate alone — so the gap above it is the effect of your repayments.",
  config: {
    actual: { label: "Actual", color: "hsl(220, 70%, 50%)" },
    expected: { label: "Interest only", color: "hsl(220, 10%, 60%)" },
    contributed: { label: "Net contributed", color: "hsl(150, 55%, 42%)" },
  } satisfies ChartConfig,
};

interface AccountTrajectoryChartProps {
  account: AccountDetailView;
}

export function AccountTrajectoryChart({
  account,
}: Readonly<AccountTrajectoryChartProps>) {
  const { transfers } = useAssetTracker();
  const externalFlows = selectAccountExternalFlows(
    account.id,
    transfers,
    account.capitalFlows,
  );
  const trajectory = buildAccountHistorySeries(
    account,
    account.snapshots,
    externalFlows,
  );
  if (trajectory.length < 2) return null;

  const hasPerformanceHistory = account.snapshots.length >= 2;
  let copy = CONTRIBUTION_COPY;
  if (isLiability(account.assetType)) {
    copy = LIABILITY_COPY;
  } else if (hasPerformanceHistory) {
    copy = ASSET_COPY;
  }

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
              dot={account.snapshots.length < 2}
              connectNulls
            />
            {hasPerformanceHistory && (
              <Line
                type="monotone"
                dataKey="expected"
                stroke="hsl(220, 10%, 60%)"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                connectNulls
              />
            )}
            {externalFlows.length > 0 && (
              <Line
                type="stepAfter"
                dataKey="contributed"
                stroke="hsl(150, 55%, 42%)"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
