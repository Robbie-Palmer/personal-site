import { addMonths, format, parseISO } from "date-fns";
import { effectiveExpectedReturn } from "./account";
import { realRate } from "./assetTrackerAnalytics";
import { todayIsoDate } from "./assetTrackerCommands";
import { DEFAULT_WITHDRAWAL_RATE } from "./assetTrackerData";
import { getNetWorthTimeSeries } from "./assetTrackerQueries";
import type { AssetTrackerRepository } from "./assetTrackerRepository";
import type { NetWorthDataPoint } from "./assetTrackerViews";
import { type CapitalFlow, capitalFlowKind } from "./capitalFlow";

const DAYS_PER_YEAR = 365.2425;
export const FI_PROJECTION_MAX_YEARS = 100;

export type PortfolioReconciliationPeriod = {
  startDate: string;
  endDate: string;
  openingNetWorth: number;
  closingNetWorth: number;
  income: number;
  /** Deposits less withdrawals across every account during the period. */
  netCapitalFlow: number;
  /** Capital retained from the income being reconciled, including debt principal. */
  personalCapitalFlow: number;
  /** The part of personal capital that paid down debt principal. */
  debtPrincipalFlow: number;
  /** Employer contributions, gifts, and other capital outside entered income. */
  externalCapitalFlow: number;
  /** Whether retained income came from recorded flows or a balance-change fallback. */
  retainedIncomeSource: "recorded-flows" | "balance-change";
  /** Closing net worth − opening net worth − net capital flow. */
  valuationGain: number;
  /** Income not retained on the complete balance sheet. */
  expenditure: number;
  /** Expenditure plus debt principal paid during the period. */
  currentExpenditure: number;
  days: number;
  annualizedExpenditure: number;
  annualizedCurrentExpenditure: number;
};

export type PortfolioFinancialIndependence = {
  periods: PortfolioReconciliationPeriod[];
  representativeAnnualExpenditure: number | null;
  representativeAnnualCurrentExpenditure: number | null;
  representativeAnnualSavings: number | null;
  /** Income retained divided by income across all reconciled periods. */
  savingsRate: number | null;
  /** Positive balances in open cash accounts. */
  emergencyFund: number;
  emergencyFundMonths: number | null;
  target: number | null;
  progress: number | null;
  /** Expected annual portfolio return after inflation, weighted by balance. */
  expectedRealReturn: number | null;
  projection: PortfolioFiProjectionPoint[];
  projectedFiDate: string | null;
  yearsToFi: number | null;
};

export type PortfolioFiProjectionPoint = {
  date: string;
  /** Projected portfolio value expressed in today's money. */
  projected: number;
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
  const lower = sorted[middle - 1];
  const upper = sorted[middle];
  return lower == null || upper == null ? null : (lower + upper) / 2;
}

function reconcileRetainedIncome(
  periodFlows: readonly CapitalFlow[],
  balanceChange: number,
): Pick<
  PortfolioReconciliationPeriod,
  | "netCapitalFlow"
  | "retainedIncomeSource"
  | "valuationGain"
  | "personalCapitalFlow"
  | "debtPrincipalFlow"
  | "externalCapitalFlow"
> {
  if (periodFlows.length === 0) {
    return {
      netCapitalFlow: balanceChange,
      personalCapitalFlow: balanceChange,
      debtPrincipalFlow: 0,
      externalCapitalFlow: 0,
      retainedIncomeSource: "balance-change",
      valuationGain: 0,
    };
  }
  let netCapitalFlow = 0;
  let personalCapitalFlow = 0;
  let debtPrincipalFlow = 0;
  let externalCapitalFlow = 0;
  for (const flow of periodFlows) {
    netCapitalFlow += flow.amount;
    const kind = capitalFlowKind(flow);
    if (kind === "external") {
      externalCapitalFlow += flow.amount;
    } else {
      personalCapitalFlow += flow.amount;
      if (kind === "debtPrincipal") debtPrincipalFlow += flow.amount;
    }
  }
  return {
    netCapitalFlow,
    personalCapitalFlow,
    debtPrincipalFlow,
    externalCapitalFlow,
    retainedIncomeSource: "recorded-flows",
    valuationGain: balanceChange - netCapitalFlow,
  };
}

/**
 * Reconciles each imported income period against the complete balance sheet:
 *
 * opening net worth + income − long-term expenditure + external capital
 * + valuation gain = closing net worth
 *
 * Signed capital flows across all accounts cancel internal transfers. Personal
 * saving and debt principal are retained income. External capital, such as an
 * employer pension contribution, increases the portfolio without reducing
 * spending derived from the user's entered income. Current expenditure adds
 * debt principal back to long-term expenditure because it is a cash commitment
 * that ends when the debt is repaid.
 *
 * When no flows are recorded for a period, the total balance-sheet change is
 * used as retained income and valuation gain is assumed to be zero. The first
 * income row uses the latest earlier balance-sheet observation as its opening
 * boundary; subsequent rows use the previous income date.
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
    if (!Number.isFinite(days) || days <= 0 || closing.date <= opening.date) {
      continue;
    }

    const periodFlows = repository.capitalFlows.filter(
      (flow) => flow.date > startDate && flow.date <= record.date,
    );
    const balanceChange = closing.total - opening.total;
    const retainedIncome = reconcileRetainedIncome(periodFlows, balanceChange);
    const expenditure = record.amount - retainedIncome.personalCapitalFlow;
    const currentExpenditure = expenditure + retainedIncome.debtPrincipalFlow;

    periods.push({
      startDate,
      endDate: record.date,
      openingNetWorth: opening.total,
      closingNetWorth: closing.total,
      income: record.amount,
      ...retainedIncome,
      expenditure,
      currentExpenditure,
      days,
      annualizedExpenditure: (expenditure * DAYS_PER_YEAR) / days,
      annualizedCurrentExpenditure: (currentExpenditure * DAYS_PER_YEAR) / days,
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

/** Current spending includes debt principal that will end at payoff. */
export function representativeAnnualCurrentExpenditure(
  periods: readonly PortfolioReconciliationPeriod[],
): number | null {
  return median(
    periods
      .map((period) => period.annualizedCurrentExpenditure)
      .filter((value) => Number.isFinite(value) && value >= 0),
  );
}

/** Median annualised total capital added resists one unusually lumpy period. */
export function representativeAnnualSavings(
  periods: readonly PortfolioReconciliationPeriod[],
): number | null {
  return median(
    periods
      .map((period) => (period.netCapitalFlow * DAYS_PER_YEAR) / period.days)
      .filter(Number.isFinite),
  );
}

function latestBalances(
  repository: AssetTrackerRepository,
): Map<string, number> {
  const balances = new Map<string, { date: string; balance: number }>();
  for (const snapshot of repository.snapshots) {
    const latest = balances.get(snapshot.accountId);
    if (latest == null || snapshot.date > latest.date) {
      balances.set(snapshot.accountId, {
        date: snapshot.date,
        balance: snapshot.balance,
      });
    }
  }
  return new Map(
    Array.from(balances, ([accountId, snapshot]) => [
      accountId,
      snapshot.balance,
    ]),
  );
}

function expectedPortfolioRealReturn(
  repository: AssetTrackerRepository,
  balances: ReadonlyMap<string, number>,
  currentNetWorth: number,
  asOfDate: string,
): number | null {
  if (!Number.isFinite(currentNetWorth) || currentNetWorth === 0) return null;
  let expectedAnnualChange = 0;
  for (const account of repository.accounts.values()) {
    if (account.closedAt != null) continue;
    expectedAnnualChange +=
      (balances.get(account.id) ?? 0) *
      effectiveExpectedReturn(account, asOfDate);
  }
  const nominal = expectedAnnualChange / currentNetWorth;
  const inflation = repository.settings.expectedAnnualInflation;
  if (!Number.isFinite(nominal) || nominal <= -1 || inflation <= -1) {
    return null;
  }
  const expectedReal = realRate(nominal, inflation);
  return Number.isFinite(expectedReal) && expectedReal > -1
    ? expectedReal
    : null;
}

function buildFiProjection(input: {
  startDate: string;
  currentNetWorth: number;
  target: number;
  annualSavings: number;
  expectedRealReturn: number;
}): {
  projection: PortfolioFiProjectionPoint[];
  projectedFiDate: string | null;
  yearsToFi: number | null;
} {
  const projection: PortfolioFiProjectionPoint[] = [
    { date: input.startDate, projected: input.currentNetWorth },
  ];
  if (input.currentNetWorth >= input.target) {
    return {
      projection,
      projectedFiDate: input.startDate,
      yearsToFi: 0,
    };
  }

  const monthlyReturn = (1 + input.expectedRealReturn) ** (1 / 12) - 1;
  const monthlySavings = input.annualSavings / 12;
  const start = parseISO(input.startDate);
  let balance = input.currentNetWorth;
  const maxMonths = FI_PROJECTION_MAX_YEARS * 12;
  for (let month = 1; month <= maxMonths; month++) {
    balance = balance * (1 + monthlyReturn) + monthlySavings;
    const date = format(addMonths(start, month), "yyyy-MM-dd");
    projection.push({
      date,
      projected: Math.round(balance * 100) / 100,
    });
    if (balance >= input.target) {
      return {
        projection,
        projectedFiDate: date,
        yearsToFi: month / 12,
      };
    }
  }
  return { projection, projectedFiDate: null, yearsToFi: null };
}

export function getPortfolioFinancialIndependence(
  repository: AssetTrackerRepository,
): PortfolioFinancialIndependence {
  const periods = reconcilePortfolio(repository);
  const annualExpenditure = representativeAnnualExpenditure(periods);
  const annualCurrentExpenditure =
    representativeAnnualCurrentExpenditure(periods);
  const annualSavings = representativeAnnualSavings(periods);
  const totalIncome = periods.reduce((sum, period) => sum + period.income, 0);
  const totalSavings = periods.reduce(
    (sum, period) => sum + period.personalCapitalFlow,
    0,
  );
  const savingsRate = totalIncome > 0 ? totalSavings / totalIncome : null;
  const withdrawalRate =
    repository.settings.withdrawalRate ?? DEFAULT_WITHDRAWAL_RATE;
  const target =
    annualExpenditure == null ||
    !Number.isFinite(withdrawalRate) ||
    withdrawalRate <= 0 ||
    withdrawalRate > 1
      ? null
      : annualExpenditure / withdrawalRate;
  const currentNetWorth = getNetWorthTimeSeries(repository).at(-1)?.total ?? 0;
  const balances = latestBalances(repository);
  const emergencyFund = Array.from(repository.accounts.values()).reduce(
    (sum, account) =>
      account.assetType === "cash" && account.closedAt == null
        ? sum + Math.max(balances.get(account.id) ?? 0, 0)
        : sum,
    0,
  );
  const emergencyFundMonths =
    annualCurrentExpenditure != null && annualCurrentExpenditure > 0
      ? (emergencyFund * 12) / annualCurrentExpenditure
      : null;
  const startDate = todayIsoDate();
  const expectedRealReturn = expectedPortfolioRealReturn(
    repository,
    balances,
    currentNetWorth,
    startDate,
  );
  const fiProjection =
    target != null &&
    target > 0 &&
    annualSavings != null &&
    expectedRealReturn != null
      ? buildFiProjection({
          startDate,
          currentNetWorth,
          target,
          annualSavings,
          expectedRealReturn,
        })
      : { projection: [], projectedFiDate: null, yearsToFi: null };
  return {
    periods,
    representativeAnnualExpenditure: annualExpenditure,
    representativeAnnualCurrentExpenditure: annualCurrentExpenditure,
    representativeAnnualSavings: annualSavings,
    savingsRate,
    emergencyFund,
    emergencyFundMonths,
    target,
    progress:
      target == null || target <= 0
        ? null
        : Math.min(Math.max(currentNetWorth / target, 0), 1),
    expectedRealReturn,
    ...fiProjection,
  };
}
