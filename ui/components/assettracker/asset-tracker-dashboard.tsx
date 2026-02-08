"use client";
import type {
  AccountDetailView,
  AccountSummaryView,
  NetWorthDataPoint,
} from "@/lib/api/assettracker";
import type { AssetType } from "@/lib/domain/assettracker";
import { AccountBalanceChart } from "./account-balance-chart";
import { AccountsTable } from "./accounts-table";
import { AssetAllocationChart } from "./asset-allocation-chart";
import { NetWorthChart } from "./net-worth-chart";

interface AssetTrackerDashboardProps {
  accounts: AccountSummaryView[];
  accountDetails: AccountDetailView[];
  netWorthData: NetWorthDataPoint[];
  assetAllocation: { assetType: AssetType; total: number }[];
}

export function AssetTrackerDashboard({
  accounts,
  accountDetails,
  netWorthData,
  assetAllocation,
}: AssetTrackerDashboardProps) {
  const totalBalance = accounts.reduce(
    (sum, a) => sum + (a.latestBalance ?? 0),
    0,
  );
  const openAccounts = accounts.filter((a) => a.isOpen);
  const accountNames = accounts.map((a) => a.name);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Asset Tracker</h1>
        <p className="text-lg text-muted-foreground">
          Track and visualise your portfolio across accounts.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="border rounded-lg p-6">
          <p className="text-sm text-muted-foreground">Total Net Worth</p>
          <p className="text-3xl font-bold mt-1">
            £{totalBalance.toLocaleString()}
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
        <AccountsTable accounts={accounts} />
      </div>
    </div>
  );
}
