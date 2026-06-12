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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  type AccountDetailView,
  buildExpectedTrajectory,
  formatAccountCurrency,
  formatAnnualRate,
  formatAssetTrackerError,
} from "@/lib/domain/assettracker";
import { useAssetTracker } from "./asset-tracker-provider";
import { LogBalanceDrawer } from "./log-balance-drawer";

const TRAJECTORY_CONFIG: ChartConfig = {
  actual: { label: "Actual", color: "hsl(220, 70%, 50%)" },
  expected: { label: "Expected", color: "hsl(220, 10%, 60%)" },
};

interface AccountDetailSheetProps {
  accountId: string | null;
  onClose(): void;
}

export function AccountDetailSheet({
  accountId,
  onClose,
}: AccountDetailSheetProps) {
  const { accountDetails, closeAccount, deleteSnapshot } = useAssetTracker();
  const [error, setError] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);

  const account =
    accountDetails.find((detail) => detail.id === accountId) ?? null;

  function handleOpenChange(open: boolean) {
    if (!open) {
      setError(null);
      setConfirmingClose(false);
      onClose();
    }
  }

  async function handleCloseAccount(detail: AccountDetailView) {
    if (!confirmingClose) {
      setConfirmingClose(true);
      return;
    }
    try {
      await closeAccount(detail.id);
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

  const trajectory = account
    ? buildExpectedTrajectory(account.expectedAnnualReturn, account.snapshots)
    : [];

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
              <div className="grid grid-cols-3 gap-3">
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
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">CAGR</p>
                  <p className="mt-1 font-semibold">
                    {account.cagr != null
                      ? formatAnnualRate(account.cagr)
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Expected</p>
                  <p className="mt-1 font-semibold">
                    {formatAnnualRate(account.expectedAnnualReturn)}
                  </p>
                </div>
              </div>

              {trajectory.length >= 2 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">
                    Actual vs expected growth
                  </h3>
                  <ChartContainer
                    config={TRAJECTORY_CONFIG}
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
                          dot={false}
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

              {error && <p className="text-sm text-destructive">{error}</p>}

              {account.isOpen && (
                <div className="flex flex-wrap items-center gap-2">
                  <LogBalanceDrawer accountId={account.id} />
                  <Button
                    variant={confirmingClose ? "destructive" : "outline"}
                    onClick={() => handleCloseAccount(account)}
                  >
                    {confirmingClose
                      ? "Confirm close (records a zero balance today)"
                      : "Close account"}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
