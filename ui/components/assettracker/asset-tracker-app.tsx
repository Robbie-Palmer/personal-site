"use client";

import { AssetTrackerDashboard } from "./asset-tracker-dashboard";
import { AssetTrackerProvider } from "./asset-tracker-provider";

export function AssetTrackerApp() {
  return (
    <AssetTrackerProvider>
      <AssetTrackerDashboard />
    </AssetTrackerProvider>
  );
}
