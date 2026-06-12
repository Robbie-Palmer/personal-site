"use client";

import { ArrowLeftRightIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatAssetTrackerError,
  todayIsoDate,
} from "@/lib/domain/assettracker";
import { useAssetTracker } from "./asset-tracker-provider";

const EXTERNAL = "external";

export function RecordTransferDrawer() {
  const { accounts, recordTransfer } = useAssetTracker();
  const openAccounts = accounts.filter((account) => account.isOpen);

  const [open, setOpen] = useState(false);
  const [fromId, setFromId] = useState(EXTERNAL);
  const [toId, setToId] = useState(openAccounts[0]?.id ?? EXTERNAL);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIsoDate());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await recordTransfer({
        date,
        fromAccountId: fromId === EXTERNAL ? undefined : fromId,
        toAccountId: toId === EXTERNAL ? undefined : toId,
        amount: Number(amount),
      });
      setOpen(false);
      setAmount("");
      setDate(todayIsoDate());
    } catch (err) {
      setError(formatAssetTrackerError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" disabled={openAccounts.length === 0}>
          <ArrowLeftRightIcon />
          Transfer
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="mx-auto w-full max-w-md">
          <DrawerTitle>Record a transfer</DrawerTitle>
          <DrawerDescription>
            Move money between accounts, or in/out from the outside world. Both
            balances update — no rescanning every account.
          </DrawerDescription>
        </DrawerHeader>
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 pb-8"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="transfer-from" className="text-sm font-medium">
                From
              </label>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger id="transfer-from" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EXTERNAL}>External (income)</SelectItem>
                  {openAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="transfer-to" className="text-sm font-medium">
                To
              </label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger id="transfer-to" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EXTERNAL}>External (spending)</SelectItem>
                  {openAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="transfer-amount" className="text-sm font-medium">
              Amount
            </label>
            <Input
              id="transfer-amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="transfer-date" className="text-sm font-medium">
              Date
            </label>
            <Input
              id="transfer-date"
              type="date"
              required
              max={todayIsoDate()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={submitting}>
              Record transfer
            </Button>
            <DrawerClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DrawerClose>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
