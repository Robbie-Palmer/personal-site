import { DEFAULT_WITHDRAWAL_RATE } from "./assetTrackerData";
import { getNetWorthTimeSeries } from "./assetTrackerQueries";
import type { AssetTrackerRepository } from "./assetTrackerRepository";
import type { NetWorthDataPoint } from "./assetTrackerViews";

const DAYS_PER_YEAR = 365.2425;

export type PortfolioReconciliationPeriod = {
  startDate: string;
  endDate: string;
  openingNetWorth: number;
  closingNetWorth: number;
  income: number;
  /** Deposits less withdrawals across every account during the period. */
  netCapitalFlow: number;
  /** Closing net worth − opening net worth − net capital flow. */
  valuationGain: number;
  /** Income not retained on the complete balance sheet. */
  expenditure: number;
  days: number;
  annualizedExpenditure: number;
};

export type PortfolioFinancialIndependence = {
  periods: PortfolioReconciliationPeriod[];
  representativeAnnualExpenditure: number | null;
  target: number | null;
  progress: number | null;
};

function calendarDaysBetween(start: string, end: string): number {
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  return (
    (Date.UTC(endYear ?? 0, (endMonth ?? 1) - 1, endDay ?? 1) -
      Date.UTC(startYear ?? 0, (startMonth ?? 1) - 1, startDay ?? 1)) /
    86_400_000
  );
}

function latestPointBefore(
  series: readonly NetWorthDataPoint[],
  date: string,
): NetWorthDataPoint | null {
  let latest: NetWorthDataPoint | null = null;
  for (const point of series) {
    if (point.date >= date) break;
    latest = point;
  }
  return latest;
}

function pointAsOf(
  series: readonly NetWorthDataPoint[],
  date: string,
): NetWorthDataPoint | null {
  let latest: NetWorthDataPoint | null = null;
  for (const point of series) {
    if (point.date > date) break;
    latest = point;
  }
  return latest;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * Reconciles each imported income period against the complete balance sheet:
 *
 * opening net worth + income − expenditure + valuation gain = closing net worth
 *
 * Signed capital flows across all accounts cancel internal transfers. Their
 * net is therefore the part of income retained (or prior wealth spent), which
 * makes expenditure `income − net capital flow`. The first income row uses the
 * latest earlier balance-sheet observation as its opening boundary; subsequent
 * rows use the previous income date.
 */
export function reconcilePortfolio(
  repository: AssetTrackerRepository,
): PortfolioReconciliationPeriod[] {
  const netWorth = getNetWorthTimeSeries(repository);
  const income = repository.incomeHistory.toSorted((a, b) =>
    a.date.localeCompare(b.date),
  );

  const periods: PortfolioReconciliationPeriod[] = [];
  for (const [index, record] of income.entries()) {
    const previousIncome = income[index - 1];
    const opening = previousIncome
      ? pointAsOf(netWorth, previousIncome.date)
      : latestPointBefore(netWorth, record.date);
    const closing = pointAsOf(netWorth, record.date);
    if (opening == null || closing == null) continue;

    const startDate = previousIncome?.date ?? opening.date;
    if (opening.date !== startDate || closing.date !== record.date) continue;
    const days = calendarDaysBetween(startDate, record.date);
    if (days <= 0 || closing.date <= opening.date) continue;

    const netCapitalFlow = repository.capitalFlows.reduce(
      (sum, flow) =>
        flow.date > startDate && flow.date <= record.date
          ? sum + flow.amount
          : sum,
      0,
    );
    const valuationGain = closing.total - opening.total - netCapitalFlow;
    const expenditure = record.amount - netCapitalFlow;

    periods.push({
      startDate,
      endDate: record.date,
      openingNetWorth: opening.total,
      closingNetWorth: closing.total,
      income: record.amount,
      netCapitalFlow,
      valuationGain,
      expenditure,
      days,
      annualizedExpenditure: (expenditure * DAYS_PER_YEAR) / days,
    });
  }
  return periods;
}

/** Median annualised period expenditure resists one unusually lumpy period. */
export function representativeAnnualExpenditure(
  periods: readonly PortfolioReconciliationPeriod[],
): number | null {
  return median(
    periods
      .map((period) => period.annualizedExpenditure)
      .filter((value) => Number.isFinite(value) && value >= 0),
  );
}

export function getPortfolioFinancialIndependence(
  repository: AssetTrackerRepository,
): PortfolioFinancialIndependence {
  const periods = reconcilePortfolio(repository);
  const annualExpenditure = representativeAnnualExpenditure(periods);
  const withdrawalRate =
    repository.settings.withdrawalRate ?? DEFAULT_WITHDRAWAL_RATE;
  const target =
    annualExpenditure == null || withdrawalRate == null
      ? null
      : annualExpenditure / withdrawalRate;
  const currentNetWorth = getNetWorthTimeSeries(repository).at(-1)?.total ?? 0;
  return {
    periods,
    representativeAnnualExpenditure: annualExpenditure,
    target,
    progress:
      target == null || target <= 0
        ? null
        : Math.min(Math.max(currentNetWorth / target, 0), 1),
  };
}
