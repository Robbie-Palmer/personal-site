"use client";

import { Trash2Icon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type AccountDetailView,
  type FlowFrequency,
  formatAccountCurrency,
  formatAssetTrackerError,
  isLiability,
  monthlyAmount,
  type RecurringFlow,
} from "@/lib/domain/assettracker";
import { useAssetTracker } from "./asset-tracker-provider";

const EXTERNAL = "external";

const FREQUENCY_OPTIONS: { value: FlowFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

type FlowKind = "fixed" | "minimumPayment";

interface AccountFlowsProps {
  account: AccountDetailView;
}

export function AccountFlows({ account }: AccountFlowsProps) {
  const { accounts, recurringFlows, addRecurringFlow, deleteRecurringFlow } =
    useAssetTracker();
  const accountFlows = recurringFlows.filter(
    (flow) =>
      flow.fromAccountId === account.id || flow.toAccountId === account.id,
  );
  const otherOpenAccounts = accounts.filter(
    (a) => a.isOpen && a.id !== account.id,
  );

  const [name, setName] = useState("");
  const [kind, setKind] = useState<FlowKind>("fixed");
  const [amount, setAmount] = useState("");
  const [percent, setPercent] = useState("");
  const [floor, setFloor] = useState("");
  const [frequency, setFrequency] = useState<FlowFrequency>("monthly");
  const [sourceId, setSourceId] = useState(EXTERNAL);
  const [error, setError] = useState<string | null>(null);

  function accountName(accountId: string | undefined): string {
    if (accountId == null) return "External";
    return accounts.find((a) => a.id === accountId)?.name ?? accountId;
  }

  function flowDescription(flow: RecurringFlow): string {
    const into = flow.toAccountId === account.id;
    const counterparty = accountName(
      into ? flow.fromAccountId : flow.toAccountId,
    );
    const formulaNote = flow.formula
      ? ` · min payment (${(flow.formula.percentOfBalance * 100).toFixed(1)}%, floor ${formatAccountCurrency(flow.formula.floor, account.currency)})`
      : "";
    return `${into ? "from" : "to"} ${counterparty}${formulaNote}`;
  }

  function flowMonthly(flow: RecurringFlow): number {
    // Formula payments are driven by the liability's outstanding balance
    const liabilityBalance = flow.formula
      ? (accounts.find((a) => a.id === flow.toAccountId)?.latestBalance ?? 0)
      : undefined;
    return monthlyAmount(flow, liabilityBalance);
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await addRecurringFlow({
        name,
        amount: kind === "fixed" ? Number(amount) : undefined,
        formula:
          kind === "minimumPayment"
            ? {
                kind: "minimumPayment",
                percentOfBalance: Number(percent) / 100,
                floor: Number(floor || "0"),
              }
            : undefined,
        frequency: kind === "minimumPayment" ? "monthly" : frequency,
        fromAccountId: sourceId === EXTERNAL ? undefined : sourceId,
        toAccountId: account.id,
      });
      setName("");
      setAmount("");
      setPercent("");
      setFloor("");
      setKind("fixed");
      setFrequency("monthly");
      setSourceId(EXTERNAL);
    } catch (err) {
      setError(formatAssetTrackerError(err));
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteRecurringFlow(id);
    } catch (err) {
      setError(formatAssetTrackerError(err));
    }
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Expected regular flows</h3>
      {accountFlows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No expected income or contributions yet — add one to power the
          projection.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {accountFlows.map((flow) => {
            const into = flow.toAccountId === account.id;
            const signedMonthly =
              ((into ? 1 : -1) * Math.round(flowMonthly(flow) * 100)) / 100;
            return (
              <li
                key={flow.id}
                className="flex items-center gap-2 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{flow.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {flow.frequency} · {flowDescription(flow)}
                  </p>
                </div>
                <span className="ml-auto shrink-0 font-mono">
                  {signedMonthly >= 0 ? "+" : ""}
                  {formatAccountCurrency(signedMonthly, account.currency)}/mo
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete flow ${flow.name}`}
                  onClick={() => handleDelete(flow.id)}
                >
                  <Trash2Icon />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {account.isOpen && (
        <form onSubmit={handleAdd} className="mt-3 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Input
              aria-label="Flow name"
              required
              placeholder="e.g. Salary"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {isLiability(account.assetType) ? (
              <Select
                value={kind}
                onValueChange={(value) => setKind(value as FlowKind)}
              >
                <SelectTrigger aria-label="Flow type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed amount</SelectItem>
                  <SelectItem value="minimumPayment">
                    Minimum payment (% of balance)
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                aria-label="Flow amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                required
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            )}
          </div>
          {isLiability(account.assetType) &&
            (kind === "fixed" ? (
              <Input
                aria-label="Flow amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                required
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  aria-label="Percent of balance"
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  max="99"
                  step="0.1"
                  required
                  placeholder="% of balance, e.g. 2.5"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                />
                <Input
                  aria-label="Minimum payment floor"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="Floor, e.g. 25"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                />
              </div>
            ))}
          <div className="grid grid-cols-2 gap-2">
            {kind === "fixed" && (
              <Select
                value={frequency}
                onValueChange={(value) => setFrequency(value as FlowFrequency)}
              >
                <SelectTrigger aria-label="Flow frequency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger aria-label="Flow source" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EXTERNAL}>From external income</SelectItem>
                {otherOpenAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    From {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" variant="outline" size="sm">
            Add expected flow into this account
          </Button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
