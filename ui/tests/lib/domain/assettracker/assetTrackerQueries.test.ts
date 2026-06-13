import { describe, expect, it } from "vitest";
import type { AssetTrackerData } from "@/lib/domain/assettracker/assetTrackerData";
import {
  getNetWorthTimeSeries,
  getTotalByAssetType,
} from "@/lib/domain/assettracker/assetTrackerQueries";
import { buildRepository } from "@/lib/domain/assettracker/assetTrackerRepository";

function homeData(): AssetTrackerData {
  return {
    accounts: [
      {
        id: "home",
        name: "Home",
        provider: "Owned",
        currency: "GBP",
        assetType: "property",
        expectedAnnualReturn: 0.03,
        createdAt: "2023-01-01",
      },
      {
        id: "mortgage",
        name: "Mortgage",
        provider: "Nationwide",
        currency: "GBP",
        assetType: "mortgage",
        expectedAnnualReturn: 0.0425,
        linkedAccountId: "home",
        createdAt: "2023-01-01",
      },
      {
        id: "card",
        name: "Credit Card",
        provider: "Amex",
        currency: "GBP",
        assetType: "debt",
        expectedAnnualReturn: 0.249,
        createdAt: "2023-01-01",
      },
    ],
    snapshots: [
      { accountId: "home", date: "2024-01-01", balance: 300000 },
      { accountId: "mortgage", date: "2024-01-01", balance: -210000 },
      { accountId: "card", date: "2024-01-01", balance: -2000 },
    ],
    transfers: [],
    recurringFlows: [],
    settings: { expectedAnnualInflation: 0.025 },
  };
}

describe("getTotalByAssetType", () => {
  it("nets a linked mortgage into its property as equity", () => {
    const totals = getTotalByAssetType(buildRepository(homeData()));
    const byType = Object.fromEntries(
      totals.map((t) => [t.assetType, t.total]),
    );

    // Property shows equity (300k − 210k), not gross value, and the mortgage
    // is not double-counted as its own line
    expect(byType.property).toBe(90000);
    expect(byType.mortgage).toBeUndefined();
    // Standalone debt still surfaces as its own negative total
    expect(byType.debt).toBe(-2000);
  });
});

describe("getNetWorthTimeSeries", () => {
  it("folds the mortgage into the property series and totals net worth", () => {
    const series = getNetWorthTimeSeries(buildRepository(homeData()));
    const point = series.at(-1);

    expect(point?.Home).toBe(90000);
    expect(point?.Mortgage).toBeUndefined();
    expect(point?.total).toBe(88000); // 90,000 equity − 2,000 card
  });
});
