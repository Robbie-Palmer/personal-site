"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addRealValues,
  buildPortfolioProjection,
  computeTotalBalance,
  dateTargetReached,
  formatAssetTrackerError,
  formatCurrency,
  inflateToPresent,
  projectedDateForTarget,
  todayIsoDate,
} from "@/lib/domain/assettracker";
import { useAssetTracker } from "./asset-tracker-provider";

// A goal like an FI number can be decades out
const GOAL_SEARCH_MONTHS = 480;

export function PortfolioGoal() {
  const {
    accounts,
    accountDetails,
    netWorthData,
    recurringFlows,
    inflation,
    netWorthTarget,
    netWorthTargetIsReal,
    setNetWorthTarget,
  } = useAssetTracker();
  const [draft, setDraft] = useState("");
  const [draftIsReal, setDraftIsReal] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentNetWorth = computeTotalBalance(accounts);

  const goal = useMemo(() => {
    if (netWorthTarget == null) return null;
    const today = todayIsoDate();
    // For a today's-money target, restate past net worth in today's
    // purchasing power before asking when the target was reached
    const history = netWorthData.map((point) => ({
      date: point.date,
      balance: netWorthTargetIsReal
        ? inflateToPresent(point.total, point.date, today, inflation)
        : point.total,
    }));
    const reachedOn = dateTargetReached(history, netWorthTarget);
    let projectedBy: string | null = null;
    if (reachedOn == null) {
      const nominal = buildPortfolioProjection({
        accounts: accountDetails,
        flows: recurringFlows,
        startDate: today,
        months: GOAL_SEARCH_MONTHS,
      });
      // ...and compare a today's-money target against deflated projections,
      // so the projection has to outgrow inflation to hit it
      const comparable = netWorthTargetIsReal
        ? addRealValues(nominal, inflation).map((point) => ({
            date: point.date,
            projected: point.real ?? point.projected,
          }))
        : nominal;
      projectedBy = projectedDateForTarget(comparable, netWorthTarget);
    }
    const progress = Math.min(Math.max(currentNetWorth / netWorthTarget, 0), 1);
    return { reachedOn, projectedBy, progress };
  }, [
    netWorthTarget,
    netWorthTargetIsReal,
    netWorthData,
    accountDetails,
    recurringFlows,
    inflation,
    currentNetWorth,
  ]);

  async function handleSetTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = Number(draft);
    if (!Number.isFinite(target)) return;
    try {
      await setNetWorthTarget(target, draftIsReal);
      setDraft("");
      setError(null);
    } catch (err) {
      setError(formatAssetTrackerError(err));
    }
  }

  async function handleClear() {
    try {
      await setNetWorthTarget(null);
      setError(null);
    } catch (err) {
      setError(formatAssetTrackerError(err));
    }
  }

  const moneyLabel = netWorthTargetIsReal ? "in today's money" : "nominal";
  let statusMessage: string | null = null;
  if (goal?.reachedOn) {
    statusMessage = `Reached on ${goal.reachedOn} — time for a bigger goal?`;
  } else if (goal?.projectedBy) {
    statusMessage = netWorthTargetIsReal
      ? `Projected to get there by ${goal.projectedBy} in today's purchasing power — growth has to beat inflation to count.`
      : `Projected to get there by ${goal.projectedBy}, based on expected returns and regular flows.`;
  } else if (goal) {
    statusMessage = `Not projected within ${GOAL_SEARCH_MONTHS / 12} years on current expectations.`;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net Worth Goal</CardTitle>
        <CardDescription>
          Set the number you're working towards — an emergency fund, a house
          deposit, or your FI number.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {netWorthTarget != null && goal ? (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-2xl font-bold">
                {formatCurrency(currentNetWorth)}
              </p>
              <p className="text-sm text-muted-foreground">
                of {formatCurrency(netWorthTarget)} {moneyLabel} (
                {Math.round(goal.progress * 100)}%)
              </p>
            </div>
            <div
              role="progressbar"
              aria-valuenow={Math.round(goal.progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${goal.progress * 100}%` }}
              />
            </div>
            {statusMessage && <p className="text-sm">{statusMessage}</p>}
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={handleClear}
            >
              Clear goal
            </Button>
          </>
        ) : (
          <form onSubmit={handleSetTarget} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label htmlFor="net-worth-target" className="sr-only">
                Target net worth
              </label>
              <Input
                id="net-worth-target"
                type="number"
                inputMode="decimal"
                min="1"
                step="1000"
                required
                placeholder="e.g. 500000"
                className="max-w-44"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <Button type="submit" variant="outline">
                Set goal
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={draftIsReal}
                onChange={(e) => setDraftIsReal(e.target.checked)}
              />
              In today's money — the projection must beat inflation
            </label>
          </form>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
