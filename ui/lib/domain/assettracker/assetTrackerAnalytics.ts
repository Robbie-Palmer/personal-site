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
 * Note: this is money-weighted — contributions count as growth. Prefer
 * computeMoneyWeightedReturn when transfer records are available.
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

/** Money in (+) or out (-) of an account on a date, e.g. a recorded transfer */
export type ExternalFlow = {
  date: string;
  amount: number;
};

/**
 * Annualised growth rate excluding contributions: the internal rate of
 * return that grows the starting balance, plus each recorded in/out flow
 * from its own date, into the final balance. Falls back to the plain CAGR
 * when no flows are recorded in the period (the two are then identical).
 *
 * Only flows the tracker knows about (recorded transfers) can be excluded —
 * balance jumps from unrecorded contributions still read as growth.
 */
export function computeMoneyWeightedReturn(
  snapshots: BalanceSnapshotView[],
  flows: ExternalFlow[],
): number | null {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const start = sorted.find((s) => s.balance > 0);
  const end = sorted[sorted.length - 1];
  if (!start || !end) return null;
  const years = yearsBetween(start.date, end.date);
  if (years <= 0) return null;

  const periodFlows = flows.filter(
    (flow) => flow.date > start.date && flow.date <= end.date,
  );
  if (periodFlows.length === 0) return computeCagr(snapshots);

  // Solve start*(1+r)^T + sum(flow*(1+r)^(T-t)) = end for r by bisection
  const value = (rate: number): number => {
    let total = start.balance * (1 + rate) ** years;
    for (const flow of periodFlows) {
      total += flow.amount * (1 + rate) ** yearsBetween(flow.date, end.date);
    }
    return total - end.balance;
  };

  let low = -0.9999;
  let high = 10;
  if (value(low) > 0 || value(high) < 0) return null; // no root in range
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (value(mid) > 0) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return (low + high) / 2;
}

/** The real (inflation-adjusted) equivalent of a nominal annual rate */
export function realRate(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}

export type TrajectoryPoint = {
  date: string;
  actual: number;
  expected: number;
};

/**
 * Expected-vs-actual series for forecast reconciliation. The expected curve
 * is anchored to the first recorded balance, compounds at the expected
 * annual return (honouring scheduled rate changes), and steps at each
 * recorded transfer in/out — so contributions and withdrawals move the
 * expected line without counting as performance. It is never re-anchored to
 * later actuals, so the remaining gap between the lines is pure over- or
 * under-performance against expectation.
 */
export function buildExpectedTrajectory(
  schedule: ReturnSchedule,
  snapshots: BalanceSnapshotView[],
  flows: ExternalFlow[] = [],
): TrajectoryPoint[] {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  let expected = sorted[0]?.balance ?? 0;
  let previousDate = sorted[0]?.date ?? "";
  return sorted.map((snapshot, i) => {
    if (i > 0) {
      // Compound the running expectation across the interval...
      const rate = effectiveExpectedReturn(schedule, previousDate);
      expected *=
        (1 + rate) ** Math.max(yearsBetween(previousDate, snapshot.date), 0);
      // ...then add contributions/withdrawals recorded within it, each grown
      // from its own date (a contribution isn't growth, but it earns after)
      for (const flow of flows) {
        if (flow.date > previousDate && flow.date <= snapshot.date) {
          const flowRate = effectiveExpectedReturn(schedule, flow.date);
          expected +=
            flow.amount *
            (1 + flowRate) **
              Math.max(yearsBetween(flow.date, snapshot.date), 0);
        }
      }
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
  /** The projected value deflated into today's money */
  real?: number;
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
  /** For liabilities: once paid off, payments stop instead of accumulating */
  clampAtZero?: boolean;
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
    if (input.clampAtZero && balance > 0) balance = 0;
    points.push({ date, projected: Math.round(balance * 100) / 100 });
  }
  return points;
}

/** Adds inflation-adjusted values (today's money) to a projection */
export function addRealValues(
  points: ProjectionPoint[],
  inflation: number,
): ProjectionPoint[] {
  const startDate = points[0]?.date;
  if (startDate == null) return points;
  return points.map((point) => ({
    ...point,
    real:
      Math.round(
        (point.projected /
          (1 + inflation) ** yearsBetween(startDate, point.date)) *
          100,
      ) / 100,
  }));
}

/** First projected date at or above the target, or null if never reached */
export function projectedDateForTarget(
  points: ProjectionPoint[],
  target: number,
): string | null {
  return points.find((point) => point.projected >= target)?.date ?? null;
}
