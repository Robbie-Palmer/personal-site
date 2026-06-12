import type { BalanceSnapshotView } from "./assetTrackerViews";

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

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
 * money-weighted approximation — good enough to be glanceable.
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
 * Expected-vs-actual series for forecast reconciliation. Each expected point
 * compounds the previous *actual* balance forward at the account's expected
 * annual return, re-anchoring on every entry so contributions between
 * snapshots don't compound into a runaway divergence.
 */
export function buildExpectedTrajectory(
  expectedAnnualReturn: number,
  snapshots: BalanceSnapshotView[],
): TrajectoryPoint[] {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((snapshot, i) => {
    const previous = i > 0 ? sorted[i - 1] : undefined;
    if (!previous) {
      return {
        date: snapshot.date,
        actual: snapshot.balance,
        expected: snapshot.balance,
      };
    }
    const years = yearsBetween(previous.date, snapshot.date);
    const expected =
      previous.balance * (1 + expectedAnnualReturn) ** Math.max(years, 0);
    return {
      date: snapshot.date,
      actual: snapshot.balance,
      expected: Math.round(expected * 100) / 100,
    };
  });
}
