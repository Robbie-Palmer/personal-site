"use client";

import { addDays, format, parseISO } from "date-fns";
import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatCurrency,
  todayIsoDate,
  upcomingFlowOccurrences,
} from "@/lib/domain/assettracker";
import { useAssetTracker } from "./asset-tracker-provider";

const UPCOMING_DAYS = 30;
const MAX_ROWS = 12;

export function UpcomingFlows() {
  const { accounts, accountDetails, recurringFlows } = useAssetTracker();

  const occurrences = useMemo(() => {
    const from = todayIsoDate();
    const through = format(
      addDays(parseISO(from), UPCOMING_DAYS),
      "yyyy-MM-dd",
    );
    const liabilityBalances = Object.fromEntries(
      accountDetails.map((d) => [d.id, d.latestBalance ?? 0]),
    );
    return upcomingFlowOccurrences(
      recurringFlows,
      from,
      through,
      liabilityBalances,
    );
  }, [recurringFlows, accountDetails]);

  function accountName(id: string | undefined): string {
    if (id == null) return "External";
    return accounts.find((a) => a.id === id)?.name ?? id;
  }

  const shown = occurrences.slice(0, MAX_ROWS);
  const overflow = occurrences.length - shown.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming</CardTitle>
        <CardDescription>
          Expected flows due in the next {UPCOMING_DAYS} days. Use "Record" on
          an account's flows to turn them into real transfers as they land.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No expected flows in the next {UPCOMING_DAYS} days — add regular
            income or contributions from an account's detail view.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {shown.map((occurrence) => (
              <li
                key={`${occurrence.flow.id}-${occurrence.date}`}
                className="flex items-center gap-2 px-3 py-2 text-sm"
              >
                <span className="w-24 shrink-0 text-muted-foreground">
                  {occurrence.date}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{occurrence.flow.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {accountName(occurrence.flow.fromAccountId)} →{" "}
                    {accountName(occurrence.flow.toAccountId)}
                  </p>
                </div>
                <span className="ml-auto shrink-0 font-mono">
                  {formatCurrency(Math.round(occurrence.amount * 100) / 100)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {overflow > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            +{overflow} more in this period
          </p>
        )}
      </CardContent>
    </Card>
  );
}
