"use client";

import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  type AccountDetailView,
  computeEquitySummary,
  type EquitySummary,
  effectiveExpectedReturn,
  formatAccountCurrency,
  formatAnnualRate,
  formatAssetTrackerError,
  isLiability,
  realRate,
  todayIsoDate,
} from "@/lib/domain/assettracker";
import { AccountFlows } from "./account-flows";
import { AccountProjection } from "./account-projection";
import { AccountTrajectoryChart } from "./account-trajectory-chart";
import { useAssetTracker } from "./asset-tracker-provider";
import { CloseAccountControls } from "./close-account-controls";
import { EquityProjection } from "./equity-projection";
import { ExpectedReturnEditor } from "./expected-return-editor";
import { LogBalanceDrawer } from "./log-balance-drawer";
import { RecordTransferDrawer } from "./record-transfer-drawer";

interface AccountDetailSheetProps {
  accountId: string | null;
  onClose(): void;
}

export function AccountDetailSheet({
  accountId,
  onClose,
}: AccountDetailSheetProps) {
  const { accounts, accountDetails, recurringFlows, inflation } =
    useAssetTracker();

  const account =
    accountDetails.find((detail) => detail.id === accountId) ?? null;
  const linkedMortgages = account
    ? accountDetails.filter((d) => d.linkedAccountId === account.id && d.isOpen)
    : [];
  const equity = account ? computeEquitySummary(account, accountDetails) : null;
  const liabilityBalances = Object.fromEntries(
    accountDetails.map((d) => [d.id, d.latestBalance ?? 0]),
  );
  const hasOtherOpenAccounts = account
    ? accounts.some((a) => a.isOpen && a.id !== account.id)
    : false;

  function handleOpenChange(open: boolean) {
    if (!open) onClose();
  }

  return (
    <Sheet open={account !== null} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {account && (
          <>
            <AccountSheetHeader account={account} />
            <div className="flex flex-col gap-6 px-4 pb-8">
              <StatsCards account={account} inflation={inflation} />
              <AccountTrajectoryChart account={account} />
              {equity && <EquityCard account={account} equity={equity} />}
              {account.isOpen && (
                <AccountProjection
                  account={account}
                  flows={recurringFlows}
                  liabilityBalances={liabilityBalances}
                  inflation={inflation}
                />
              )}
              {account.assetType === "property" &&
                linkedMortgages.length > 0 && (
                  <EquityProjection
                    property={account}
                    mortgages={linkedMortgages}
                    flows={recurringFlows}
                    liabilityBalances={liabilityBalances}
                    inflation={inflation}
                  />
                )}
              <AccountFlows account={account} />
              <ExpectedReturnEditor account={account} />
              <BalanceHistory account={account} />
              <TransfersList account={account} />
              {account.isOpen && (
                <div className="flex flex-col gap-3 border-t pt-4">
                  <div className="flex flex-wrap gap-2">
                    <LogBalanceDrawer accountId={account.id} />
                    {hasOtherOpenAccounts && (
                      <RecordTransferDrawer fromAccountId={account.id} />
                    )}
                  </div>
                  {/* key resets the pending confirmation when the account changes */}
                  <CloseAccountControls key={account.id} account={account} />
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function AccountSheetHeader({ account }: { account: AccountDetailView }) {
  const closedSuffix = account.closedAt ? ` · closed ${account.closedAt}` : "";
  return (
    <SheetHeader>
      <SheetTitle>{account.name}</SheetTitle>
      <SheetDescription>
        {account.provider} · opened {account.createdAt}
        {closedSuffix}
      </SheetDescription>
      <div className="flex gap-2">
        <Badge variant="secondary">{account.assetType}</Badge>
        <Badge variant={account.isOpen ? "default" : "secondary"}>
          {account.isOpen ? "Open" : "Closed"}
        </Badge>
      </div>
    </SheetHeader>
  );
}

function StatsCards({
  account,
  inflation,
}: {
  account: AccountDetailView;
  inflation: number;
}) {
  const liability = isLiability(account.assetType);
  const currentRate = effectiveExpectedReturn(account, todayIsoDate());
  const balanceText =
    account.latestBalance != null
      ? formatAccountCurrency(account.latestBalance, account.currency)
      : "—";
  const cagrText = account.cagr != null ? formatAnnualRate(account.cagr) : "—";
  const gridClass = liability
    ? "grid grid-cols-2 gap-3"
    : "grid grid-cols-3 gap-3";

  return (
    <div className={gridClass}>
      <div className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">Balance</p>
        <p className="mt-1 font-semibold">{balanceText}</p>
      </div>
      {/* CAGR is meaningless for a debt being paid down, so omit it */}
      {!liability && (
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">CAGR</p>
          <p className="mt-1 font-semibold">{cagrText}</p>
          <p className="text-xs text-muted-foreground">excl. contributions</p>
        </div>
      )}
      <div className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">
          {liability ? "Interest rate" : "Expected now"}
        </p>
        <p className="mt-1 font-semibold">{formatAnnualRate(currentRate)}</p>
        <p className="text-xs text-muted-foreground">
          {formatAnnualRate(realRate(currentRate, inflation))} real
        </p>
      </div>
    </div>
  );
}

function EquityCard({
  account,
  equity,
}: {
  account: AccountDetailView;
  equity: EquitySummary;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">
        Equity in {equity.propertyName}
      </p>
      <p className="mt-1 font-semibold">
        {formatAccountCurrency(equity.value, account.currency)}
      </p>
    </div>
  );
}

function BalanceHistory({ account }: { account: AccountDetailView }) {
  const { deleteSnapshot } = useAssetTracker();
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(date: string) {
    try {
      await deleteSnapshot({ accountId: account.id, date });
      setError(null);
    } catch (err) {
      setError(formatAssetTrackerError(err));
    }
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Balance history</h3>
      {account.snapshots.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No balances recorded yet.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {[...account.snapshots].reverse().map((snapshot) => (
            <li
              key={snapshot.date}
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground">{snapshot.date}</span>
              <span className="ml-auto font-mono">
                {formatAccountCurrency(snapshot.balance, account.currency)}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete balance from ${snapshot.date}`}
                onClick={() => handleDelete(snapshot.date)}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

function TransfersList({ account }: { account: AccountDetailView }) {
  const { accounts, transfers } = useAssetTracker();
  const accountTransfers = transfers.filter(
    (t) => t.fromAccountId === account.id || t.toAccountId === account.id,
  );
  if (accountTransfers.length === 0) return null;

  function counterpartyName(id: string | undefined): string {
    if (id == null) return "External";
    return accounts.find((a) => a.id === id)?.name ?? id;
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Transfers</h3>
      <ul className="divide-y rounded-lg border">
        {[...accountTransfers].reverse().map((transfer) => {
          const into = transfer.toAccountId === account.id;
          const counterparty = counterpartyName(
            into ? transfer.fromAccountId : transfer.toAccountId,
          );
          return (
            <li
              key={transfer.id}
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground">
                {transfer.date} · {into ? "from" : "to"} {counterparty}
              </span>
              <span className="font-mono">
                {into ? "+" : "−"}
                {formatAccountCurrency(transfer.amount, account.currency)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
