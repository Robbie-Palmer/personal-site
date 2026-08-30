import { describe, expect, it } from "vitest";
import type { AssetTrackerData } from "@/lib/domain/assettracker/assetTrackerData";
import {
  getAccountDetail,
  getAssetAllocationTimeSeries,
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
    capitalFlows: [],
    incomeHistory: [],
    transfers: [],
    recurringFlows: [],
    settings: { expectedAnnualInflation: 0.025, withdrawalRate: 0.04 },
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

describe("getAssetAllocationTimeSeries", () => {
  it("tracks asset-type percentages over time and treats property as home equity", () => {
    const data = homeData();
    data.accounts.push({
      id: "cash",
      name: "Emergency fund",
      provider: "Bank",
      currency: "GBP",
      assetType: "cash",
      expectedAnnualReturn: 0,
      createdAt: "2023-01-01",
    });
    data.snapshots.push(
      { accountId: "cash", date: "2024-01-01", balance: 10_000 },
      { accountId: "home", date: "2025-01-01", balance: 320_000 },
      { accountId: "mortgage", date: "2025-01-01", balance: -200_000 },
      { accountId: "cash", date: "2025-01-01", balance: 20_000 },
    );

    const series = getAssetAllocationTimeSeries(buildRepository(data));

    expect(series).toHaveLength(2);
    expect(series[0]).toMatchObject({
      date: "2024-01-01",
      totalAssets: 100_000,
      cash: 0.1,
      property: 0.9,
    });
    expect(series[1]).toMatchObject({
      date: "2025-01-01",
      totalAssets: 140_000,
    });
    expect(series[1]?.cash).toBeCloseTo(1 / 7);
    expect(series[1]?.property).toBeCloseTo(6 / 7);
    expect(series[1]?.debt).toBeUndefined();
    expect(series[1]?.mortgage).toBeUndefined();
  });

  it("removes closed accounts even when a closing-day snapshot is non-zero", () => {
    const data = homeData();
    data.accounts = [
      {
        id: "cash",
        name: "Cash",
        provider: "Bank",
        currency: "GBP",
        assetType: "cash",
        expectedAnnualReturn: 0,
        createdAt: "2024-01-01",
      },
      {
        id: "stocks",
        name: "Old ISA",
        provider: "Broker",
        currency: "GBP",
        assetType: "stocks",
        expectedAnnualReturn: 0.05,
        createdAt: "2024-01-01",
        closedAt: "2025-01-01",
      },
    ];
    data.snapshots = [
      { accountId: "cash", date: "2024-01-01", balance: 10_000 },
      { accountId: "stocks", date: "2024-01-01", balance: 10_000 },
      { accountId: "cash", date: "2025-01-01", balance: 20_000 },
      { accountId: "stocks", date: "2025-01-01", balance: 10_000 },
    ];

    const series = getAssetAllocationTimeSeries(buildRepository(data));

    expect(series[0]).toMatchObject({ cash: 0.5, stocks: 0.5 });
    expect(series[1]).toMatchObject({ cash: 1, totalAssets: 20_000 });
    expect(series[1]?.stocks).toBeUndefined();
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

describe("getAccountDetail", () => {
  it("derives net contributed capital and current gain or loss", () => {
    const data = homeData();
    data.capitalFlows = [
      { accountId: "home", date: "2023-01-01", amount: 80000 },
      { accountId: "home", date: "2024-01-01", amount: 10000 },
    ];

    const account = getAccountDetail(buildRepository(data), "home");

    expect(account?.netContributed).toBe(90000);
    expect(account?.gainLoss).toBe(210000);
    expect(account?.capitalFlows).toEqual([
      { date: "2023-01-01", amount: 80000 },
      { date: "2024-01-01", amount: 10000 },
    ]);
  });

  it("rejects duplicate dated capital records before rendering date keys", () => {
    const data = homeData();
    data.capitalFlows = [
      { accountId: "home", date: "2024-01-01", amount: 1000 },
      { accountId: "home", date: "2024-01-01", amount: 2000 },
    ];

    expect(() => buildRepository(data)).toThrow(
      'Duplicate capital flow for account "home" on 2024-01-01',
    );
  });
});
