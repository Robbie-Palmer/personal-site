import { AssetTrackerDashboard } from "@/components/assettracker/asset-tracker-dashboard";
import {
  getAccount,
  getAllAccounts,
  getAssetAllocation,
  getNetWorthData,
} from "@/lib/api/assettracker";

export default function AssetTrackerPage() {
  const accounts = getAllAccounts();
  const accountDetails = accounts.map((a) => getAccount(a.id));
  const netWorthData = getNetWorthData();
  const assetAllocation = getAssetAllocation();
  return (
    <AssetTrackerDashboard
      accounts={accounts}
      accountDetails={accountDetails}
      netWorthData={netWorthData}
      assetAllocation={assetAllocation}
    />
  );
}
