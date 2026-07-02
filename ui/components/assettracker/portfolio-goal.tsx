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
  buildPortfolioProjection,
  computeTotalBalance,
  dateTargetReached,
  formatAssetTrackerError,
  formatCurrency,
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
    netWorthTarget,
    setNetWorthTarget,
  } = useAssetTracker();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const currentNetWorth = computeTotalBalance(accounts);

  const goal = useMemo(() => {
    if (netWorthTarget == null) return null;
    const reachedOn = dateTargetReached(
      netWorthData.map((point) => ({ date: point.date, balance: point.total })),
      netWorthTarget,
    );
    const projectedBy = reachedOn
      ? null
      : projectedDateForTarget(
          buildPortfolioProjection({
            accounts: accountDetails,
            flows: recurringFlows,
            startDate: todayIsoDate(),
            months: GOAL_SEARCH_MONTHS,
          }),
          netWorthTarget,
        );
    const progress = Math.min(Math.max(currentNetWorth / netWorthTarget, 0), 1);
    return { reachedOn, projectedBy, progress };
  }, [
    netWorthTarget,
    netWorthData,
    accountDetails,
    recurringFlows,
    currentNetWorth,
  ]);

  async function handleSetTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = Number(draft);
    if (!Number.isFinite(target)) return;
    try {
      await setNetWorthTarget(target);
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

  let statusMessage: string | null = null;
  if (goal?.reachedOn) {
    statusMessage = `Reached on ${goal.reachedOn} — time for a bigger goal?`;
  } else if (goal?.projectedBy) {
    statusMessage = `Projected to get there by ${goal.projectedBy}, based on expected returns and regular flows.`;
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
                of {formatCurrency(netWorthTarget)} (
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
          <form onSubmit={handleSetTarget} className="flex items-center gap-2">
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
          </form>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
