"use client";

import { useState } from "react";
import {
  formatAnnualRate,
  formatCurrency,
  formatTotalBalances,
  realRate,
} from "@/lib/domain/assettracker";
import { AccountBalanceChart } from "./account-balance-chart";
import { AccountDetailSheet } from "./account-detail-sheet";
import { AccountHistoryImportDrawer } from "./account-history-import-drawer";
import { AccountsTable } from "./accounts-table";
import { AddAccountDrawer } from "./add-account-drawer";
import { AssetAllocationChart } from "./asset-allocation-chart";
import { AssetAllocationHistoryChart } from "./asset-allocation-history-chart";
import { useAssetTracker } from "./asset-tracker-provider";
import { DataControls } from "./data-controls";
import { FlowSankeyChart } from "./flow-sankey-chart";
import { LogBalanceDrawer } from "./log-balance-drawer";
import { NetWorthChart } from "./net-worth-chart";
import { PortfolioContributionChart } from "./portfolio-contribution-chart";
import { PortfolioGoal } from "./portfolio-goal";
import { RecordTransferDrawer } from "./record-transfer-drawer";
import { UpcomingFlows } from "./upcoming-flows";

export function AssetTrackerDashboard() {
  const {
    accounts,
    accountDetails,
    netWorthData,
    contributionData,
    assetAllocation,
    assetAllocationHistory,
    portfolioReturn,
    inflation,
  } = useAssetTracker();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  );

  const openAccounts = accounts.filter((a) => a.isOpen);
  const contributedCapital = contributionData.at(-1)?.contributedCapital;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Asset Tracker</h1>
          <p className="text-lg text-muted-foreground">
            Track and visualise your portfolio across accounts.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <AccountHistoryImportDrawer />
          <LogBalanceDrawer />
          <RecordTransferDrawer />
          <AddAccountDrawer />
        </div>
      </div>
      <DataControls />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="border rounded-lg p-6">
          <p className="text-sm text-muted-foreground">Market net worth</p>
          <p className="text-3xl font-bold mt-1">
            {formatTotalBalances(openAccounts)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Latest valuations less liabilities
          </p>
        </div>
        <div className="border rounded-lg p-6">
          <p className="text-sm text-muted-foreground">Portfolio Growth</p>
          <p className="text-3xl font-bold mt-1">
            {portfolioReturn != null
              ? `${formatAnnualRate(portfolioReturn)}/yr`
              : "—"}
          </p>
          {portfolioReturn != null && (
            <p className="text-xs text-muted-foreground mt-1">
              {formatAnnualRate(realRate(portfolioReturn, inflation))}/yr after
              inflation · excludes recorded contributions
            </p>
          )}
        </div>
        <div className="border rounded-lg p-6">
          <p className="text-sm text-muted-foreground">Contributed capital</p>
          <p className="text-3xl font-bold mt-1">
            {contributedCapital == null
              ? "—"
              : formatCurrency(contributedCapital)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Deposits minus withdrawals
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
      <NetWorthChart data={netWorthData} />
      <PortfolioContributionChart data={contributionData} />
      <AssetAllocationHistoryChart data={assetAllocationHistory} />
      <PortfolioGoal />
      <div className="grid gap-8 lg:grid-cols-2">
        <UpcomingFlows />
        <FlowSankeyChart />
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <AssetAllocationChart data={assetAllocation} />
        <AccountBalanceChart accounts={accountDetails} />
      </div>
      <div>
        <h2 className="text-2xl font-semibold mb-4">Accounts</h2>
        <AccountsTable
          accounts={accountDetails}
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
