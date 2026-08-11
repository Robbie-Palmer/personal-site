"use client";

import { ClipboardPasteIcon } from "lucide-react";
import { type SubmitEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  type AccountDetailView,
  formatAssetTrackerError,
  type PastedHistoryResult,
  parsePastedHistory,
} from "@/lib/domain/assettracker";
import { useAssetTracker } from "./asset-tracker-provider";

const EMPTY_RESULT: PastedHistoryResult = { rows: [], issues: [] };

function HistoryPreview({
  label,
  result,
}: Readonly<{ label: string; result: PastedHistoryResult }>) {
  if (result.issues.length > 0) {
    return (
      <ul className="space-y-1 text-xs text-destructive">
        {result.issues.slice(0, 4).map((issue) => (
          <li key={`${issue.line}-${issue.message}`}>
            {label}, line {issue.line}: {issue.message}
          </li>
        ))}
        {result.issues.length > 4 && (
          <li>Plus {result.issues.length - 4} more errors</li>
        )}
      </ul>
    );
  }
  if (result.rows.length === 0) return null;
  const first = result.rows[0];
  const last = result.rows.at(-1);
  const rowLabel = result.rows.length === 1 ? "row" : "rows";
  return (
    <p className="text-xs text-muted-foreground">
      {result.rows.length} {label.toLowerCase()} {rowLabel} ready
      {first && last ? ` · ${first.date} to ${last.date}` : ""}
    </p>
  );
}

function HistoryTextarea({
  id,
  label,
  description,
  placeholder,
  value,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  description: string;
  placeholder: string;
  value: string;
  onChange(value: string): void;
}>) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <textarea
        id={id}
        rows={10}
        spellCheck={false}
        className="min-h-44 w-full resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function AccountHistoryImportDrawer({
  account,
}: Readonly<{ account: AccountDetailView }>) {
  const { importAccountHistory } = useAssetTracker();
  const [open, setOpen] = useState(false);
  const [balances, setBalances] = useState("");
  const [capitalFlows, setCapitalFlows] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const balanceResult = useMemo(
    () =>
      balances.trim() === "" ? EMPTY_RESULT : parsePastedHistory(balances),
    [balances],
  );
  const capitalResult = useMemo(
    () =>
      capitalFlows.trim() === ""
        ? EMPTY_RESULT
        : parsePastedHistory(capitalFlows),
    [capitalFlows],
  );
  const hasIssues =
    balanceResult.issues.length > 0 || capitalResult.issues.length > 0;
  const rowCount = balanceResult.rows.length + capitalResult.rows.length;

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasIssues) {
      setError("Fix the highlighted rows before importing");
      return;
    }
    if (rowCount === 0) {
      setError("Paste at least one balance or deposit/withdrawal");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await importAccountHistory({
        accountId: account.id,
        balances: balanceResult.rows,
        capitalFlows: capitalResult.rows,
      });
      setBalances("");
      setCapitalFlows("");
      setOpen(false);
    } catch (err) {
      setError(formatAssetTrackerError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm">
          <ClipboardPasteIcon />
          Paste history
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[92dvh] overflow-y-auto">
        <DrawerHeader className="mx-auto w-full max-w-4xl">
          <DrawerTitle>Paste history for {account.name}</DrawerTitle>
          <DrawerDescription>
            Copy two columns from your spreadsheet. Headers are optional; comma-
            and tab-separated values both work. Matching dates replace the
            existing value.
          </DrawerDescription>
        </DrawerHeader>
        <form
          onSubmit={handleSubmit}
          className="mx-auto grid w-full max-w-4xl gap-5 p-4 pb-8 md:grid-cols-2"
        >
          <div className="flex min-w-0 flex-col gap-2">
            <HistoryTextarea
              id={`balance-history-${account.id}`}
              label="Balance / market value"
              description="The account value observed on each date."
              placeholder={"date,value\n2024-01-31,12500\n2024-02-29,13120"}
              value={balances}
              onChange={setBalances}
            />
            <HistoryPreview label="Balance" result={balanceResult} />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <HistoryTextarea
              id={`capital-history-${account.id}`}
              label="Deposits / withdrawals"
              description="First row: total contributed at the starting point. Later rows: change since the previous observation, with deposits positive and withdrawals negative. When present, this history replaces transfer-derived flows in return calculations."
              placeholder={"date,value\n2024-01-31,500\n2024-02-29,-200"}
              value={capitalFlows}
              onChange={setCapitalFlows}
            />
            <HistoryPreview label="Capital flow" result={capitalResult} />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              Nothing is saved unless every pasted row is valid.
            </p>
            <div className="flex gap-2">
              <Button
                type="submit"
                className="flex-1 sm:flex-none"
                disabled={submitting || hasIssues || rowCount === 0}
              >
                Import {rowCount > 0 ? `${rowCount} rows` : "history"}
              </Button>
              <DrawerClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DrawerClose>
            </div>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
