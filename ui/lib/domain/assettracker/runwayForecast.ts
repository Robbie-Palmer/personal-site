import { addMonths, format, parseISO } from "date-fns";
import {
  type Account,
  accountLiquidity,
  effectiveExpectedReturn,
  isLiability,
} from "./account";
import { realRate } from "./assetTrackerAnalytics";
import type { AssetTrackerRepository } from "./assetTrackerRepository";
import type { PlannedExpenditure } from "./plannedExpenditure";
import { monthlyAmount, type RecurringFlow } from "./recurringFlow";

export const RUNWAY_FORECAST_MAX_YEARS = 30;

export type RunwayForecastPoint = {
  date: string;
  cashBalance: number;
  liquidBalance: number;
  totalBalance: number;
  cashMonths: number;
  liquidMonths: number;
  totalMonths: number;
  baselineCashMonths: number;
  baselineLiquidMonths: number;
  baselineTotalMonths: number;
};

type ProjectedAccount = {
  account: Account;
  balance: number;
};

type ForecastBalances = {
  cashBalance: number;
  liquidBalance: number;
  totalBalance: number;
};

function latestBalances(
  repository: AssetTrackerRepository,
): Map<string, number> {
  const latest = new Map<string, { date: string; balance: number }>();
  for (const snapshot of repository.snapshots) {
    const existing = latest.get(snapshot.accountId);
    if (existing == null || snapshot.date > existing.date) {
      latest.set(snapshot.accountId, snapshot);
    }
  }
  return new Map(
    Array.from(latest, ([accountId, snapshot]) => [
      accountId,
      snapshot.balance,
    ]),
  );
}

function balancesByAccess(accounts: ProjectedAccount[]): ForecastBalances {
  let cashBalance = 0;
  let liquidBalance = 0;
  let totalBalance = 0;
  for (const projected of accounts) {
    const { account, balance } = projected;
    totalBalance += balance;
    if (isLiability(account.assetType)) continue;
    const liquidity = accountLiquidity(account);
    if (liquidity === "cash") cashBalance += balance;
    if (liquidity !== "illiquid") liquidBalance += balance;
  }
  return {
    cashBalance: Math.max(cashBalance, 0),
    liquidBalance: Math.max(liquidBalance, 0),
    totalBalance,
  };
}

function flowIsActive(flow: RecurringFlow, date: string): boolean {
  return (
    flow.startDate <= date && (flow.endDate == null || date <= flow.endDate)
  );
}

function applyExpectedFlow(
  byId: Map<string, ProjectedAccount>,
  flow: RecurringFlow,
  date: string,
): void {
  if (!flowIsActive(flow, date)) return;
  const source =
    flow.fromAccountId == null ? null : byId.get(flow.fromAccountId);
  const destination =
    flow.toAccountId == null ? null : byId.get(flow.toAccountId);

  if (flow.fromAccountId != null && source == null) return;
  if (flow.toAccountId != null && destination == null) return;

  // Historical spending already covers regular money leaving the portfolio.
  // External income still enters here, and owned-account transfers move the
  // appropriate liquidity pool without changing total net worth.
  if (source != null && destination == null) return;
  let amount = monthlyAmount(flow, destination?.balance);
  if (destination && isLiability(destination.account.assetType)) {
    amount = Math.min(amount, Math.max(-destination.balance, 0));
  }
  if (amount <= 0) return;
  if (source) source.balance -= amount;
  if (destination) destination.balance += amount;
}

function applyExpectedFlows(
  accounts: ProjectedAccount[],
  flows: RecurringFlow[],
  date: string,
): void {
  const byId = new Map(
    accounts.map((projected) => [projected.account.id, projected]),
  );
  for (const flow of flows) {
    applyExpectedFlow(byId, flow, date);
  }
}

function applySpending(accounts: ProjectedAccount[], amount: number): void {
  const assets = accounts.filter(
    ({ account }) => !isLiability(account.assetType),
  );
  const ranked = assets.toSorted((a, b) => {
    const liquidityRank = (projected: ProjectedAccount) => {
      const liquidity = accountLiquidity(projected.account);
      if (liquidity === "cash") return 0;
      if (liquidity === "liquid") return 1;
      return 2;
    };
    return liquidityRank(a) - liquidityRank(b) || b.balance - a.balance;
  });
  let remaining = amount;
  for (const projected of ranked) {
    if (remaining <= 0) return;
    const available = Math.max(projected.balance, 0);
    const withdrawn = Math.min(available, remaining);
    projected.balance -= withdrawn;
    remaining -= withdrawn;
  }
  if (remaining > 0 && ranked[0]) ranked[0].balance -= remaining;
}

function compoundAccounts(
  accounts: ProjectedAccount[],
  inflation: number,
  date: string,
): void {
  for (const projected of accounts) {
    if (projected.balance < 0 && !isLiability(projected.account.assetType)) {
      continue;
    }
    const nominal = effectiveExpectedReturn(projected.account, date);
    const annualRealReturn = realRate(nominal, inflation);
    projected.balance *= (1 + annualRealReturn) ** (1 / 12);
  }
}

function applyPlannedExpenditures(
  accounts: ProjectedAccount[],
  expenditures: PlannedExpenditure[],
  afterDate: string,
  throughDate: string,
): void {
  const byId = new Map(
    accounts.map((projected) => [projected.account.id, projected]),
  );
  for (const expenditure of expenditures) {
    if (expenditure.date <= afterDate || expenditure.date > throughDate) {
      continue;
    }
    const source = byId.get(expenditure.fromAccountId);
    if (source) source.balance -= expenditure.amount;
  }
}

function projectBalances(input: {
  repository: AssetTrackerRepository;
  annualExpenditure: number;
  months: number;
  includePlannedExpenditures: boolean;
  startDate: string;
}): { date: string; balances: ForecastBalances }[] {
  const latest = latestBalances(input.repository);
  const accounts = Array.from(input.repository.accounts.values())
    .filter((account) => account.closedAt == null)
    .map((account) => ({
      account,
      balance: latest.get(account.id) ?? 0,
    }));
  const points = [
    { date: input.startDate, balances: balancesByAccess(accounts) },
  ];
  const start = parseISO(input.startDate);
  let previousDate = input.startDate;
  for (let month = 1; month <= input.months; month++) {
    const date = format(addMonths(start, month), "yyyy-MM-dd");
    compoundAccounts(
      accounts,
      input.repository.settings.expectedAnnualInflation,
      date,
    );
    applyExpectedFlows(accounts, input.repository.recurringFlows, date);
    applySpending(accounts, input.annualExpenditure / 12);
    if (input.includePlannedExpenditures) {
      applyPlannedExpenditures(
        accounts,
        input.repository.plannedExpenditures,
        previousDate,
        date,
      );
    }
    points.push({ date, balances: balancesByAccess(accounts) });
    previousDate = date;
  }
  return points;
}

function monthsOfSpending(balance: number, annualCurrentExpenditure: number) {
  return Math.max((balance * 12) / annualCurrentExpenditure, 0);
}

export function buildRunwayForecast(input: {
  repository: AssetTrackerRepository;
  annualExpenditure: number | null;
  annualCurrentExpenditure: number | null;
  startDate: string;
  months?: number;
}): RunwayForecastPoint[] {
  if (
    input.annualExpenditure == null ||
    input.annualCurrentExpenditure == null ||
    input.annualCurrentExpenditure <= 0
  ) {
    return [];
  }
  const months = input.months ?? RUNWAY_FORECAST_MAX_YEARS * 12;
  const shared = {
    repository: input.repository,
    annualExpenditure: input.annualExpenditure,
    months,
    startDate: input.startDate,
  };
  const planned = projectBalances({
    ...shared,
    includePlannedExpenditures: true,
  });
  const baseline = projectBalances({
    ...shared,
    includePlannedExpenditures: false,
  });
  return planned.map((point, index) => {
    const withoutPlanned = baseline[index]?.balances ?? point.balances;
    return {
      date: point.date,
      ...point.balances,
      cashMonths: monthsOfSpending(
        point.balances.cashBalance,
        input.annualCurrentExpenditure as number,
      ),
      liquidMonths: monthsOfSpending(
        point.balances.liquidBalance,
        input.annualCurrentExpenditure as number,
      ),
      totalMonths: monthsOfSpending(
        point.balances.totalBalance,
        input.annualCurrentExpenditure as number,
      ),
      baselineCashMonths: monthsOfSpending(
        withoutPlanned.cashBalance,
        input.annualCurrentExpenditure as number,
      ),
      baselineLiquidMonths: monthsOfSpending(
        withoutPlanned.liquidBalance,
        input.annualCurrentExpenditure as number,
      ),
      baselineTotalMonths: monthsOfSpending(
        withoutPlanned.totalBalance,
        input.annualCurrentExpenditure as number,
      ),
    };
  });
}
