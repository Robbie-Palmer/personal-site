import { addMonths, format, parseISO } from "date-fns";
import {
  type Account,
  type AccountId,
  effectiveExpectedReturn,
} from "./account";
import type { BalanceSnapshotView } from "./assetTrackerViews";
import { monthlyAmount, type RecurringFlow } from "./recurringFlow";

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

type ReturnSchedule = Pick<
  Account,
  "expectedAnnualReturn" | "expectedReturnChanges"
>;

function yearsBetween(fromDate: string, toDate: string): number {
  return (
    (new Date(toDate).getTime() - new Date(fromDate).getTime()) / MS_PER_YEAR
  );
}

/**
 * Compound annual growth rate from the first positive balance to the latest
 * snapshot. Returns null when there is no meaningful growth period (fewer
 * than two snapshots, no positive starting balance, or zero elapsed time).
 *
 * Note: contributions are not separated from growth yet, so this is a
 * money-weighted approximation — good enough to be glanceable. A
 * transfers-aware internal rate of return is the eventual replacement.
 */
export function computeCagr(snapshots: BalanceSnapshotView[]): number | null {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const start = sorted.find((s) => s.balance > 0);
  const end = sorted[sorted.length - 1];
  if (!start || !end) return null;
  const years = yearsBetween(start.date, end.date);
  if (years <= 0) return null;
  return (end.balance / start.balance) ** (1 / years) - 1;
}

export type TrajectoryPoint = {
  date: string;
  actual: number;
  expected: number;
};

/**
 * Expected-vs-actual series for forecast reconciliation. The expected curve
 * compounds the first recorded balance forward at the expected annual return
 * (honouring scheduled rate changes) — one smooth projection, never
 * re-anchored to later actuals. The gap between the lines is the combined
 * effect of contributions/withdrawals and out/under-performance.
 */
export function buildExpectedTrajectory(
  schedule: ReturnSchedule,
  snapshots: BalanceSnapshotView[],
): TrajectoryPoint[] {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  let expected = sorted[0]?.balance ?? 0;
  let previousDate = sorted[0]?.date ?? "";
  return sorted.map((snapshot, i) => {
    if (i > 0) {
      const rate = effectiveExpectedReturn(schedule, previousDate);
      expected *=
        (1 + rate) ** Math.max(yearsBetween(previousDate, snapshot.date), 0);
      previousDate = snapshot.date;
    }
    return {
      date: snapshot.date,
      actual: snapshot.balance,
      expected: Math.round(expected * 100) / 100,
    };
  });
}

export type ProjectionPoint = {
  date: string;
  projected: number;
};

/**
 * Projects an account balance forward month by month: compound at the
 * expected return in force that month (rate changes respected), then apply
 * the recurring flows targeting or leaving the account.
 *
 * Formula flows (e.g. credit card minimum payments) are evaluated against
 * the running balance when this account is the liability being paid down.
 * When this account is the *source* of a formula payment, the counterparty
 * liability's latest balance (from `liabilityBalances`) is used as a
 * constant approximation.
 */
export function buildProjection(input: {
  accountId: AccountId;
  schedule: ReturnSchedule;
  startDate: string;
  startBalance: number;
  flows: RecurringFlow[];
  months: number;
  /** Latest balances of other accounts, for formula flows leaving this one */
  liabilityBalances?: Record<AccountId, number>;
}): ProjectionPoint[] {
  const start = parseISO(input.startDate);
  let balance = input.startBalance;
  const points: ProjectionPoint[] = [
    { date: input.startDate, projected: Math.round(balance * 100) / 100 },
  ];
  for (let month = 1; month <= input.months; month++) {
    const date = format(addMonths(start, month), "yyyy-MM-dd");
    const rate = effectiveExpectedReturn(input.schedule, date);
    balance *= (1 + rate) ** (1 / 12);
    for (const flow of input.flows) {
      const active =
        flow.startDate <= date &&
        (flow.endDate == null || date <= flow.endDate);
      if (!active) continue;
      if (flow.toAccountId === input.accountId) {
        balance += monthlyAmount(flow, balance);
      } else if (flow.fromAccountId === input.accountId) {
        const counterpartBalance =
          flow.toAccountId != null
            ? input.liabilityBalances?.[flow.toAccountId]
            : undefined;
        balance -= monthlyAmount(flow, counterpartBalance);
      }
    }
    points.push({ date, projected: Math.round(balance * 100) / 100 });
  }
  return points;
}

/** First projected date at or above the target, or null if never reached */
export function projectedDateForTarget(
  points: ProjectionPoint[],
  target: number,
): string | null {
  return points.find((point) => point.projected >= target)?.date ?? null;
}
