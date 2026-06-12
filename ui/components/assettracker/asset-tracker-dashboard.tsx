"use client";

import { useState } from "react";
import { computeTotalBalance, formatCurrency } from "@/lib/domain/assettracker";
import { AccountBalanceChart } from "./account-balance-chart";
import { AccountDetailSheet } from "./account-detail-sheet";
import { AccountsTable } from "./accounts-table";
import { AddAccountDrawer } from "./add-account-drawer";
import { AssetAllocationChart } from "./asset-allocation-chart";
import { useAssetTracker } from "./asset-tracker-provider";
import { DataControls } from "./data-controls";
import { LogBalanceDrawer } from "./log-balance-drawer";
import { NetWorthChart } from "./net-worth-chart";

export function AssetTrackerDashboard() {
  const { accounts, accountDetails, netWorthData, assetAllocation } =
    useAssetTracker();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  );

  const totalBalance = computeTotalBalance(accounts);
  const openAccounts = accounts.filter((a) => a.isOpen);
  const accountNames = accounts.map((a) => a.name);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Asset Tracker</h1>
          <p className="text-lg text-muted-foreground">
            Track and visualise your portfolio across accounts.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <LogBalanceDrawer />
          <AddAccountDrawer />
        </div>
      </div>
      <DataControls />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="border rounded-lg p-6">
          <p className="text-sm text-muted-foreground">Total Net Worth</p>
          <p className="text-3xl font-bold mt-1">
            {formatCurrency(totalBalance)}
          </p>
        </div>
        <div className="border rounded-lg p-6">
          <p className="text-sm text-muted-foreground">Open Accounts</p>
          <p className="text-3xl font-bold mt-1">{openAccounts.length}</p>
        </div>
        <div className="border rounded-lg p-6">
          <p className="text-sm text-muted-foreground">Asset Types</p>
          <p className="text-3xl font-bold mt-1">{assetAllocation.length}</p>
        </div>
      </div>
      <NetWorthChart data={netWorthData} accountNames={accountNames} />
      <div className="grid gap-8 lg:grid-cols-2">
        <AssetAllocationChart data={assetAllocation} />
        <AccountBalanceChart accounts={accountDetails} />
      </div>
      <div>
        <h2 className="text-2xl font-semibold mb-4">Accounts</h2>
        <AccountsTable
          accounts={accounts}
          onSelectAccount={setSelectedAccountId}
        />
      </div>
      <AccountDetailSheet
        accountId={selectedAccountId}
        onClose={() => setSelectedAccountId(null)}
      />
    </div>
  );
}
