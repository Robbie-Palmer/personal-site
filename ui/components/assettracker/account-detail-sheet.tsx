"use client";

import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  type AccountDetailView,
  buildExpectedTrajectory,
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
import { useAssetTracker } from "./asset-tracker-provider";
import { EquityProjection } from "./equity-projection";
import { ExpectedReturnEditor } from "./expected-return-editor";
import { LogBalanceDrawer } from "./log-balance-drawer";
import { RecordTransferDrawer } from "./record-transfer-drawer";

const KEEP_BALANCE = "keep";

const TRAJECTORY_CONFIG: ChartConfig = {
  actual: { label: "Actual", color: "hsl(220, 70%, 50%)" },
  expected: { label: "Expected", color: "hsl(220, 10%, 60%)" },
};
const LIABILITY_TRAJECTORY_CONFIG: ChartConfig = {
  actual: { label: "Actual", color: "hsl(220, 70%, 50%)" },
  expected: { label: "Interest only", color: "hsl(220, 10%, 60%)" },
};

interface AccountDetailSheetProps {
  accountId: string | null;
  onClose(): void;
}

export function AccountDetailSheet({
  accountId,
  onClose,
}: AccountDetailSheetProps) {
  const {
    accounts,
    accountDetails,
    recurringFlows,
    transfers,
    inflation,
    closeAccount,
    deleteSnapshot,
  } = useAssetTracker();
  const [error, setError] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState(KEEP_BALANCE);

  const account =
    accountDetails.find((detail) => detail.id === accountId) ?? null;
  const accountTransfers = account
    ? transfers.filter(
        (t) => t.fromAccountId === account.id || t.toAccountId === account.id,
      )
    : [];
  const otherOpenAccounts = account
    ? accounts.filter((a) => a.isOpen && a.id !== account.id)
    : [];

  function accountName(id: string | undefined): string {
    if (id == null) return "External";
    return accounts.find((a) => a.id === id)?.name ?? id;
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setError(null);
      setConfirmingClose(false);
      setTransferTargetId(KEEP_BALANCE);
      onClose();
    }
  }

  async function handleCloseAccount(detail: AccountDetailView) {
    if (!confirmingClose) {
      setConfirmingClose(true);
      return;
    }
    try {
      await closeAccount(
        detail.id,
        transferTargetId === KEEP_BALANCE ? undefined : transferTargetId,
      );
      setConfirmingClose(false);
      setError(null);
    } catch (err) {
      setError(formatAssetTrackerError(err));
    }
  }

  async function handleDeleteSnapshot(detail: AccountDetailView, date: string) {
    try {
      await deleteSnapshot({ accountId: detail.id, date });
      setError(null);
    } catch (err) {
      setError(formatAssetTrackerError(err));
    }
  }

  const accountExternalFlows = account
    ? accountTransfers.map((t) => ({
        date: t.date,
        amount: t.toAccountId === account.id ? t.amount : -t.amount,
      }))
    : [];
  const trajectory = account
    ? buildExpectedTrajectory(account, account.snapshots, accountExternalFlows)
    : [];
  const isLiabilityAccount = account ? isLiability(account.assetType) : false;
  const currentRate = account
    ? effectiveExpectedReturn(account, todayIsoDate())
    : 0;
  const hasPositiveBalance =
    account?.latestBalance != null && account.latestBalance > 0;

  // Home equity: property value plus the (negative) balances of mortgages
  // secured on it, derived from the account links
  const linkedMortgages = account
    ? accountDetails.filter((d) => d.linkedAccountId === account.id && d.isOpen)
    : [];
  const linkedProperty = account?.linkedAccountId
    ? (accountDetails.find((d) => d.id === account.linkedAccountId) ?? null)
    : null;
  let equity: { propertyName: string; value: number } | null = null;
  if (
    account &&
    account.assetType === "property" &&
    linkedMortgages.length > 0
  ) {
    equity = {
      propertyName: account.name,
      value:
        (account.latestBalance ?? 0) +
        linkedMortgages.reduce((sum, m) => sum + (m.latestBalance ?? 0), 0),
    };
  } else if (account && linkedProperty) {
    equity = {
      propertyName: linkedProperty.name,
      value: (linkedProperty.latestBalance ?? 0) + (account.latestBalance ?? 0),
    };
  }

  const liabilityBalances = Object.fromEntries(
    accountDetails.map((d) => [d.id, d.latestBalance ?? 0]),
  );

  return (
    <Sheet open={account !== null} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {account && (
          <>
            <SheetHeader>
              <SheetTitle>{account.name}</SheetTitle>
              <SheetDescription>
                {account.provider} · opened {account.createdAt}
                {account.closedAt ? ` · closed ${account.closedAt}` : ""}
              </SheetDescription>
              <div className="flex gap-2">
                <Badge variant="secondary">{account.assetType}</Badge>
                <Badge variant={account.isOpen ? "default" : "secondary"}>
                  {account.isOpen ? "Open" : "Closed"}
                </Badge>
              </div>
            </SheetHeader>
            <div className="flex flex-col gap-6 px-4 pb-8">
              <div
                className={
                  isLiabilityAccount
                    ? "grid grid-cols-2 gap-3"
                    : "grid grid-cols-3 gap-3"
                }
              >
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="mt-1 font-semibold">
                    {account.latestBalance != null
                      ? formatAccountCurrency(
                          account.latestBalance,
                          account.currency,
                        )
                      : "—"}
                  </p>
                </div>
                {/* CAGR is meaningless for a debt being paid down, so omit it */}
                {!isLiabilityAccount && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">CAGR</p>
                    <p className="mt-1 font-semibold">
                      {account.cagr != null
                        ? formatAnnualRate(account.cagr)
                        : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      excl. contributions
                    </p>
                  </div>
                )}
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    {isLiabilityAccount ? "Interest rate" : "Expected now"}
                  </p>
                  <p className="mt-1 font-semibold">
                    {formatAnnualRate(currentRate)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatAnnualRate(realRate(currentRate, inflation))} real
                  </p>
                </div>
              </div>

              {trajectory.length >= 2 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">
                    {isLiabilityAccount
                      ? "Actual vs interest-only"
                      : "Actual vs expected growth"}
                  </h3>
                  <p className="mb-2 text-xs text-muted-foreground">
                    {isLiabilityAccount
                      ? "Expected compounds the opening balance at the interest rate alone — so the gap above it is the effect of your repayments."
                      : "Expected compounds the first balance at the expected return and steps with recorded transfers, so the remaining gap is pure out/under-performance."}
                  </p>
                  <ChartContainer
                    config={
                      isLiabilityAccount
                        ? LIABILITY_TRAJECTORY_CONFIG
                        : TRAJECTORY_CONFIG
                    }
                    className="aspect-auto w-full"
                  >
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart
                        data={trajectory}
                        margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-muted"
                        />
                        <XAxis dataKey="date" className="text-xs" hide />
                        <YAxis
                          className="text-xs"
                          width={45}
                          tickFormatter={(v: number) =>
                            `${(v / 1000).toFixed(0)}k`
                          }
                        />
                        <ChartTooltip
                          content={<ChartTooltipContent />}
                          formatter={(value) =>
                            formatAccountCurrency(
                              value as number,
                              account.currency,
                            )
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="actual"
                          stroke="hsl(220, 70%, 50%)"
                          strokeWidth={2}
                          dot={trajectory.length === 1}
                        />
                        <Line
                          type="monotone"
                          dataKey="expected"
                          stroke="hsl(220, 10%, 60%)"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              )}

              {equity && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Equity in {equity.propertyName}
                  </p>
                  <p className="mt-1 font-semibold">
                    {formatAccountCurrency(equity.value, account.currency)}
                  </p>
                </div>
              )}

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
                        <span className="text-muted-foreground">
                          {snapshot.date}
                        </span>
                        <span className="ml-auto font-mono">
                          {formatAccountCurrency(
                            snapshot.balance,
                            account.currency,
                          )}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete balance from ${snapshot.date}`}
                          onClick={() =>
                            handleDeleteSnapshot(account, snapshot.date)
                          }
                        >
                          <Trash2Icon />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {accountTransfers.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">Transfers</h3>
                  <ul className="divide-y rounded-lg border">
                    {[...accountTransfers].reverse().map((transfer) => {
                      const into = transfer.toAccountId === account.id;
                      const counterparty = accountName(
                        into ? transfer.fromAccountId : transfer.toAccountId,
                      );
                      return (
                        <li
                          key={transfer.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                          <span className="text-muted-foreground">
                            {transfer.date} · {into ? "from" : "to"}{" "}
                            {counterparty}
                          </span>
                          <span className="font-mono">
                            {into ? "+" : "−"}
                            {formatAccountCurrency(
                              transfer.amount,
                              account.currency,
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              {account.isOpen && (
                <div className="flex flex-col gap-3 border-t pt-4">
                  <div className="flex flex-wrap gap-2">
                    <LogBalanceDrawer accountId={account.id} />
                    {otherOpenAccounts.length > 0 && (
                      <RecordTransferDrawer fromAccountId={account.id} />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {hasPositiveBalance && otherOpenAccounts.length > 0 && (
                      <Select
                        value={transferTargetId}
                        onValueChange={setTransferTargetId}
                      >
                        <SelectTrigger
                          aria-label="Transfer remaining balance to"
                          className="w-full sm:w-auto"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={KEEP_BALANCE}>
                            Don't transfer balance
                          </SelectItem>
                          {otherOpenAccounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              Move balance to {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      variant={confirmingClose ? "destructive" : "outline"}
                      onClick={() => handleCloseAccount(account)}
                    >
                      {confirmingClose
                        ? transferTargetId === KEEP_BALANCE
                          ? "Confirm close (records a zero balance today)"
                          : `Confirm close & move balance`
                        : "Close account"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
