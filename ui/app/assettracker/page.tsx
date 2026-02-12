import { AssetTrackerDashboard } from "@/components/assettracker/asset-tracker-dashboard";
import {
  getAllAccountDetails,
  getAllAccounts,
  getAssetAllocation,
  getNetWorthData,
} from "@/lib/api/assettracker";

export default function AssetTrackerPage() {
  const accounts = getAllAccounts();
  const accountDetails = getAllAccountDetails();
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
