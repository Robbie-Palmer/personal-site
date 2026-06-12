"use client";

import { PlusIcon } from "lucide-react";
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
  type AssetType,
  type Currency,
  formatAssetTrackerError,
  todayIsoDate,
} from "@/lib/domain/assettracker";
import { useAssetTracker } from "./asset-tracker-provider";

const ASSET_TYPE_OPTIONS: { value: AssetType; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "stocks", label: "Stocks" },
  { value: "crypto", label: "Crypto" },
];

const CURRENCY_OPTIONS: Currency[] = ["GBP", "USD"];

export function AddAccountDrawer() {
  const { createAccount } = useAssetTracker();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("cash");
  const [currency, setCurrency] = useState<Currency>("GBP");
  const [expectedReturnPercent, setExpectedReturnPercent] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [openingDate, setOpeningDate] = useState(todayIsoDate());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setName("");
    setProvider("");
    setAssetType("cash");
    setCurrency("GBP");
    setExpectedReturnPercent("");
    setOpeningBalance("");
    setOpeningDate(todayIsoDate());
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createAccount({
        name,
        provider,
        assetType,
        currency,
        expectedAnnualReturn: Number(expectedReturnPercent) / 100,
        openingBalance:
          openingBalance === "" ? undefined : Number(openingBalance),
        openingDate,
      });
      setOpen(false);
      resetForm();
    } catch (err) {
      setError(formatAssetTrackerError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline">
          <PlusIcon />
          Add account
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="mx-auto w-full max-w-md">
          <DrawerTitle>Add an account</DrawerTitle>
          <DrawerDescription>
            Anything with a balance: savings, investments, pensions, crypto.
          </DrawerDescription>
        </DrawerHeader>
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-md flex-col gap-4 overflow-y-auto p-4 pb-8"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-account-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="add-account-name"
              required
              placeholder="e.g. Vanguard S&S ISA"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="add-account-provider"
              className="text-sm font-medium"
            >
              Provider
            </label>
            <Input
              id="add-account-provider"
              required
              placeholder="e.g. Vanguard"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="add-account-type" className="text-sm font-medium">
                Asset type
              </label>
              <Select
                value={assetType}
                onValueChange={(value) => setAssetType(value as AssetType)}
              >
                <SelectTrigger id="add-account-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="add-account-currency"
                className="text-sm font-medium"
              >
                Currency
              </label>
              <Select
                value={currency}
                onValueChange={(value) => setCurrency(value as Currency)}
              >
                <SelectTrigger id="add-account-currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-account-return" className="text-sm font-medium">
              Expected annual return (%)
            </label>
            <Input
              id="add-account-return"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="-99"
              max="99"
              required
              placeholder="e.g. 7"
              value={expectedReturnPercent}
              onChange={(e) => setExpectedReturnPercent(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="add-account-balance"
                className="text-sm font-medium"
              >
                Opening balance
              </label>
              <Input
                id="add-account-balance"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="Optional"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="add-account-date" className="text-sm font-medium">
                As of
              </label>
              <Input
                id="add-account-date"
                type="date"
                required
                max={todayIsoDate()}
                value={openingDate}
                onChange={(e) => setOpeningDate(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={submitting}>
              Add account
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
