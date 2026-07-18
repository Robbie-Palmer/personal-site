"use client";

import { Badge } from "@/components/ui/badge";
import {
  type AccountDetailView,
  ASSET_TYPE_LABELS,
  type AssetType,
  type BalanceSnapshotView,
  formatAccountCurrency,
  formatAnnualRate,
  formatTotalBalances,
  isLiability,
  todayIsoDate,
} from "@/lib/domain/assettracker";
import { LogBalanceDrawer } from "./log-balance-drawer";

const STALE_AFTER_DAYS = 30;
const COLUMN_COUNT = 8;

const ASSET_TYPE_VARIANT: Record<
  AssetType,
  "default" | "secondary" | "outline" | "destructive"
> = {
  cash: "default",
  stocks: "secondary",
  bonds: "secondary",
  reits: "secondary",
  crypto: "outline",
  property: "secondary",
  mortgage: "destructive",
  debt: "destructive",
};

interface AccountsTableProps {
  accounts: AccountDetailView[];
  onSelectAccount?: (accountId: string) => void;
}

export function AccountsTable({
  accounts,
  onSelectAccount,
}: AccountsTableProps) {
  const assets = accounts.filter((a) => !isLiability(a.assetType));
  const liabilities = accounts.filter((a) => isLiability(a.assetType));

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Account</th>
              <th className="text-left p-3 font-medium">Provider</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Trend</th>
              <th className="text-right p-3 font-medium">Balance</th>
              <th className="text-right p-3 font-medium">CAGR</th>
              <th className="text-right p-3 font-medium">Expected Return</th>
              <th className="text-left p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <AccountsSection
              label="Assets"
              accounts={assets}
              onSelectAccount={onSelectAccount}
            />
            <AccountsSection
              label="Liabilities"
              accounts={liabilities}
              onSelectAccount={onSelectAccount}
            />
          </tbody>
          <tfoot>
            <tr className="bg-muted/50">
              <td colSpan={4} className="p-3 font-semibold">
                Net worth
              </td>
              <td className="p-3 text-right font-mono font-semibold">
                {formatTotalBalances(accounts)}
              </td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function AccountsSection({
  label,
  accounts,
  onSelectAccount,
}: {
  label: string;
  accounts: AccountDetailView[];
  onSelectAccount?: (accountId: string) => void;
}) {
  if (accounts.length === 0) return null;
  return (
    <>
      <tr className="border-b bg-muted/20">
        <td
          colSpan={COLUMN_COUNT}
          className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {label}
        </td>
      </tr>
      {accounts.map((account) => (
        <AccountRow
          key={account.id}
          account={account}
          onSelectAccount={onSelectAccount}
        />
      ))}
      <tr className="border-b">
        <td colSpan={4} className="p-3 text-sm text-muted-foreground">
          {label} total
        </td>
        <td className="p-3 text-right font-mono text-muted-foreground">
          {formatTotalBalances(accounts)}
        </td>
        <td colSpan={3} />
      </tr>
    </>
  );
}

function AccountRow({
  account,
  onSelectAccount,
}: {
  account: AccountDetailView;
  onSelectAccount?: (accountId: string) => void;
}) {
  return (
    <tr className="border-b hover:bg-muted/30">
      <td className="p-3 font-medium">
        {onSelectAccount ? (
          <button
            type="button"
            className="text-left font-medium hover:underline"
            onClick={() => onSelectAccount(account.id)}
          >
            {account.name}
          </button>
        ) : (
          account.name
        )}
        <StaleBalanceNudge account={account} />
      </td>
      <td className="p-3 text-muted-foreground">{account.provider}</td>
      <td className="p-3">
        <Badge variant={ASSET_TYPE_VARIANT[account.assetType]}>
          {ASSET_TYPE_LABELS[account.assetType]}
        </Badge>
      </td>
      <td className="p-3">
        <Sparkline snapshots={account.snapshots} />
      </td>
      <td className="p-3 text-right font-mono">
        {account.latestBalance != null
          ? formatAccountCurrency(account.latestBalance, account.currency)
          : "-"}
      </td>
      <td className="p-3 text-right font-mono">
        {account.cagr != null ? formatAnnualRate(account.cagr) : "—"}
      </td>
      <td className="p-3 text-right font-mono">
        {(account.expectedAnnualReturn * 100).toFixed(1)}%
      </td>
      <td className="p-3">
        <Badge variant={account.isOpen ? "default" : "secondary"}>
          {account.isOpen ? "Open" : "Closed"}
        </Badge>
      </td>
    </tr>
  );
}

/**
 * The retention loop for a manual-entry tracker: surface how stale each
 * balance is and make the fix one tap away (a prefilled log-balance drawer).
 */
function StaleBalanceNudge({ account }: { account: AccountDetailView }) {
  if (!account.isOpen) return null;
  let message: string | null = null;
  if (account.latestSnapshotDate == null) {
    message = "No balance yet — log one";
  } else {
    const days = Math.floor(
      (Date.parse(todayIsoDate()) - Date.parse(account.latestSnapshotDate)) /
        86_400_000,
    );
    if (days >= STALE_AFTER_DAYS) {
      message = `Updated ${days}d ago — log now`;
    }
  }
  if (message == null) return null;
  return (
    <LogBalanceDrawer
      accountId={account.id}
      trigger={
        <button
          type="button"
          className="mt-0.5 block text-left text-xs font-normal text-amber-600 hover:underline dark:text-amber-500"
        >
          {message}
        </button>
      }
    />
  );
}

const SPARK_WIDTH = 72;
const SPARK_HEIGHT = 22;

function Sparkline({ snapshots }: { snapshots: BalanceSnapshotView[] }) {
  if (snapshots.length < 2) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const values = snapshots.map((s) => s.balance);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const step = SPARK_WIDTH / (values.length - 1);
  const points = values
    .map((value, i) => {
      const x = i * step;
      const y =
        SPARK_HEIGHT - 2 - ((value - min) / spread) * (SPARK_HEIGHT - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={SPARK_WIDTH}
      height={SPARK_HEIGHT}
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      className="text-muted-foreground"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
