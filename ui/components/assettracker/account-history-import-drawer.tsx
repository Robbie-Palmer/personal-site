"use client";

import { ClipboardPasteIcon } from "lucide-react";
import { type SubmitEvent, useMemo, useRef, useState } from "react";
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
  source,
  textareaId,
}: Readonly<{
  label: string;
  result: PastedHistoryResult;
  source: string;
  textareaId: string;
}>) {
  function selectLine(line: number) {
    const textarea = document.getElementById(textareaId);
    if (!(textarea instanceof HTMLTextAreaElement)) return;

    let start = 0;
    for (let currentLine = 1; currentLine < line; currentLine++) {
      const newline = source.indexOf("\n", start);
      if (newline === -1) return;
      start = newline + 1;
    }
    let end = source.indexOf("\n", start);
    if (end === -1) end = source.length;
    if (source[end - 1] === "\r") end--;

    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(start, end);
    const parsedLineHeight = Number.parseFloat(
      window.getComputedStyle(textarea).lineHeight,
    );
    const lineHeight = Number.isFinite(parsedLineHeight)
      ? parsedLineHeight
      : 20;
    const scrollTop = Math.max(0, (line - 2) * lineHeight);
    textarea.scrollTop = scrollTop;
    textarea.scrollLeft = 0;
    const lineNumbers = document.getElementById(`${textareaId}-line-numbers`);
    if (lineNumbers) lineNumbers.scrollTop = scrollTop;
  }

  if (result.issues.length > 0) {
    return (
      <div className="space-y-2 text-xs">
        <p className="text-destructive">
          {result.issues.length} {label.toLowerCase()}{" "}
          {result.issues.length === 1 ? "row needs" : "rows need"} attention.
          Select one to jump to it.
        </p>
        <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-destructive/30 p-1">
          {result.issues.map((issue) => (
            <li key={`${issue.line}-${issue.message}`}>
              <button
                type="button"
                className="w-full rounded-sm px-2 py-1.5 text-left hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => selectLine(issue.line)}
              >
                <span className="font-medium text-destructive">
                  Line {issue.line}: {issue.message}
                </span>
                {issue.source != null && (
                  <code className="mt-0.5 block whitespace-pre-wrap break-all text-muted-foreground">
                    {issue.source}
                  </code>
                )}
              </button>
            </li>
          ))}
        </ul>
        {result.rows.length > 0 && (
          <p className="text-muted-foreground">
            {result.rows.length} other{" "}
            {result.rows.length === 1 ? "row is" : "rows are"} valid.
          </p>
        )}
      </div>
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
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const lineCount = value.split(/\r?\n/).length;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex min-h-44 w-full items-stretch overflow-hidden rounded-md border bg-transparent shadow-xs focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]">
        <div
          id={`${id}-line-numbers`}
          ref={lineNumbersRef}
          aria-hidden="true"
          className="w-12 shrink-0 overflow-hidden border-r bg-muted/40 px-2 py-2 text-right font-mono text-sm leading-5 text-muted-foreground select-none"
        >
          <div className="whitespace-pre">
            {Array.from({ length: lineCount }, (_, index) => index + 1).join(
              "\n",
            )}
          </div>
        </div>
        <textarea
          id={id}
          rows={10}
          wrap="off"
          spellCheck={false}
          className="min-h-44 min-w-0 flex-1 resize-y overflow-x-auto bg-transparent px-3 py-2 font-mono text-sm leading-5 outline-none"
          placeholder={placeholder}
          value={value}
          onScroll={(event) => {
            if (lineNumbersRef.current) {
              lineNumbersRef.current.scrollTop = event.currentTarget.scrollTop;
            }
          }}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
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
  const balanceTextareaId = `balance-history-${account.id}`;
  const capitalTextareaId = `capital-history-${account.id}`;

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
              id={balanceTextareaId}
              label="Balance / market value"
              description="The account value observed on each date."
              placeholder={"date,value\n2024-01-31,12500\n2024-02-29,13120"}
              value={balances}
              onChange={setBalances}
            />
            <HistoryPreview
              label="Balance"
              result={balanceResult}
              source={balances}
              textareaId={balanceTextareaId}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <HistoryTextarea
              id={capitalTextareaId}
              label="Deposits / withdrawals"
              description="First row: total contributed at the starting point. Later rows: change since the previous observation, with deposits positive and withdrawals negative. When present, this history replaces transfer-derived flows in return calculations."
              placeholder={"date,value\n2024-01-31,500\n2024-02-29,-200"}
              value={capitalFlows}
              onChange={setCapitalFlows}
            />
            <HistoryPreview
              label="Capital flow"
              result={capitalResult}
              source={capitalFlows}
              textareaId={capitalTextareaId}
            />
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
