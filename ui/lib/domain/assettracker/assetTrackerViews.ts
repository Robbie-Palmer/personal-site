import type { Account, AssetType, Currency } from "./account";
import type { BalanceSnapshot } from "./balanceSnapshot";

export type AccountSummaryView = {
  id: string;
  name: string;
  provider: string;
  currency: Currency;
  assetType: AssetType;
  expectedAnnualReturn: number;
  isOpen: boolean;
  latestBalance: number | null;
  latestSnapshotDate: string | null;
};

export type BalanceSnapshotView = {
  date: string;
  balance: number;
};

export type AccountDetailView = AccountSummaryView & {
  createdAt: string;
  closedAt?: string;
  snapshots: BalanceSnapshotView[];
};

export type NetWorthDataPoint = {
  date: string;
  total: number;
  [accountName: string]: string | number;
};

export function toAccountSummaryView(
  account: Account,
  snapshots: BalanceSnapshot[],
): AccountSummaryView {
  const accountSnapshots = snapshots
    .filter((s) => s.accountId === account.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latest = accountSnapshots[0] ?? null;
  return {
    id: account.id,
    name: account.name,
    provider: account.provider,
    currency: account.currency,
    assetType: account.assetType,
    expectedAnnualReturn: account.expectedAnnualReturn,
    isOpen: !account.closedAt,
    latestBalance: latest?.balance ?? null,
    latestSnapshotDate: latest?.date ?? null,
  };
}

export function toAccountDetailView(
  account: Account,
  snapshots: BalanceSnapshot[],
): AccountDetailView {
  const accountSnapshots = snapshots
    .filter((s) => s.accountId === account.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return {
    ...toAccountSummaryView(account, snapshots),
    createdAt: account.createdAt,
    closedAt: account.closedAt,
    snapshots: accountSnapshots.map((s) => ({
      date: s.date,
      balance: s.balance,
    })),
  };
}

export function toNetWorthTimeSeries(
  accounts: Account[],
  snapshots: BalanceSnapshot[],
): NetWorthDataPoint[] {
  const dateSet = new Set(snapshots.map((s) => s.date));
  const sortedDates = Array.from(dateSet).sort();
  const latestByAccountAndDate = new Map<string, number>();
  const sortedSnapshots = [...snapshots].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  return sortedDates.map((date) => {
    for (const snapshot of sortedSnapshots) {
      if (new Date(snapshot.date) <= new Date(date)) {
        latestByAccountAndDate.set(snapshot.accountId, snapshot.balance);
      }
    }
    const point: NetWorthDataPoint = { date, total: 0 };
    for (const account of accounts) {
      const balance = latestByAccountAndDate.get(account.id) ?? 0;
      point[account.name] = balance;
      point.total += balance;
    }
    return point;
  });
}
