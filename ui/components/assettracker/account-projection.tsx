"use client";

import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
  type AccountDetailView,
  buildProjection,
  formatAccountCurrency,
  projectedDateForTarget,
  type RecurringFlow,
} from "@/lib/domain/assettracker";

const PROJECTION_MONTHS = 60;

const PROJECTION_CONFIG: ChartConfig = {
  projected: { label: "Projected", color: "hsl(160, 60%, 45%)" },
};

interface AccountProjectionProps {
  account: AccountDetailView;
  flows: RecurringFlow[];
  /** Latest balances by account ID, for formula flows paying other accounts */
  liabilityBalances: Record<string, number>;
}

export function AccountProjection({
  account,
  flows,
  liabilityBalances,
}: AccountProjectionProps) {
  const [target, setTarget] = useState("");

  const projection = useMemo(() => {
    if (account.latestBalance == null || account.latestSnapshotDate == null) {
      return [];
    }
    return buildProjection({
      accountId: account.id,
      schedule: account,
      startDate: account.latestSnapshotDate,
      startBalance: account.latestBalance,
      flows,
      months: PROJECTION_MONTHS,
      liabilityBalances,
    });
  }, [account, flows, liabilityBalances]);

  if (projection.length === 0) return null;

  const targetAmount = target === "" ? null : Number(target);
  const targetDate =
    targetAmount != null && Number.isFinite(targetAmount)
      ? projectedDateForTarget(projection, targetAmount)
      : null;

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">
        Projection — next {PROJECTION_MONTHS / 12} years
      </h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Compounds the latest balance at the expected return and applies the
        expected regular flows below.
      </p>
      <ChartContainer config={PROJECTION_CONFIG} className="aspect-auto w-full">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart
            data={projection}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" className="text-xs" hide />
            <YAxis
              className="text-xs"
              width={45}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
            />
            <ChartTooltip
              content={<ChartTooltipContent />}
              formatter={(value) =>
                formatAccountCurrency(value as number, account.currency)
              }
            />
            <Line
              type="monotone"
              dataKey="projected"
              stroke="hsl(160, 60%, 45%)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
      <div className="mt-3 flex items-center gap-2">
        <label
          htmlFor={`projection-target-${account.id}`}
          className="shrink-0 text-sm font-medium"
        >
          Target ({account.currency})
        </label>
        <Input
          id={`projection-target-${account.id}`}
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder={
            account.latestBalance != null && account.latestBalance < 0
              ? "e.g. 0 (paid off)"
              : "e.g. 20000"
          }
          className="max-w-36"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
      </div>
      {targetAmount != null && Number.isFinite(targetAmount) && (
        <p className="mt-2 text-sm">
          {targetDate
            ? `Projected to reach ${formatAccountCurrency(targetAmount, account.currency)} by ${targetDate}.`
            : `Not projected to reach ${formatAccountCurrency(targetAmount, account.currency)} within ${PROJECTION_MONTHS / 12} years.`}
        </p>
      )}
    </div>
  );
}
