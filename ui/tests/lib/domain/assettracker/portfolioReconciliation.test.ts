import { describe, expect, it } from "vitest";
import type { AssetTrackerData } from "@/lib/domain/assettracker";
import {
  buildRepository,
  getNetWorthTimeSeries,
  getPortfolioFinancialIndependence,
  reconcilePortfolio,
  representativeAnnualExpenditure,
} from "@/lib/domain/assettracker";

function portfolioData(): AssetTrackerData {
  return {
    accounts: [
      {
        id: "portfolio",
        name: "Portfolio",
        provider: "Broker",
        currency: "GBP",
        assetType: "stocks",
        expectedAnnualReturn: 0.05,
        createdAt: "2024-01-01",
      },
    ],
    snapshots: [
      { accountId: "portfolio", date: "2024-01-31", balance: 100_000 },
      { accountId: "portfolio", date: "2024-02-29", balance: 108_000 },
      { accountId: "portfolio", date: "2024-03-31", balance: 113_000 },
    ],
    capitalFlows: [
      { accountId: "portfolio", date: "2024-02-15", amount: 5_000 },
      { accountId: "portfolio", date: "2024-03-15", amount: 2_000 },
    ],
    incomeHistory: [
      { date: "2024-02-29", amount: 10_000 },
      { date: "2024-03-31", amount: 8_000 },
    ],
    transfers: [],
    recurringFlows: [],
    settings: { expectedAnnualInflation: 0.025, withdrawalRate: 0.04 },
  };
}

describe("reconcilePortfolio", () => {
  it("separates balance changes into retained income, expenditure, and valuation gains", () => {
    const periods = reconcilePortfolio(buildRepository(portfolioData()));

    expect(periods).toHaveLength(2);
    expect(periods[0]).toMatchObject({
      startDate: "2024-01-31",
      endDate: "2024-02-29",
      openingNetWorth: 100_000,
      closingNetWorth: 108_000,
      income: 10_000,
      netCapitalFlow: 5_000,
      valuationGain: 3_000,
      expenditure: 5_000,
    });
    expect(periods[1]).toMatchObject({
      startDate: "2024-02-29",
      endDate: "2024-03-31",
      openingNetWorth: 108_000,
      closingNetWorth: 113_000,
      income: 8_000,
      netCapitalFlow: 2_000,
      valuationGain: 3_000,
      expenditure: 6_000,
    });

    for (const period of periods) {
      expect(
        period.openingNetWorth +
          period.income -
          period.expenditure +
          period.valuationGain,
      ).toBe(period.closingNetWorth);
    }
  });

  it("cancels signed internal transfers across accounts", () => {
    const data = portfolioData();
    data.accounts.push({
      id: "cash",
      name: "Cash",
      provider: "Bank",
      currency: "GBP",
      assetType: "cash",
      expectedAnnualReturn: 0,
      createdAt: "2024-01-01",
    });
    data.snapshots.push(
      { accountId: "cash", date: "2024-01-31", balance: 10_000 },
      { accountId: "cash", date: "2024-02-29", balance: 5_000 },
    );
    data.capitalFlows.push(
      { accountId: "cash", date: "2024-02-10", amount: -1_000 },
      { accountId: "portfolio", date: "2024-02-10", amount: 1_000 },
    );

    expect(reconcilePortfolio(buildRepository(data))[0]?.netCapitalFlow).toBe(
      5_000,
    );
  });

  it("skips periods whose income boundaries do not match balance observations", () => {
    const data = portfolioData();
    data.snapshots = [
      { accountId: "portfolio", date: "2024-01-31", balance: 100_000 },
      { accountId: "portfolio", date: "2024-03-31", balance: 113_000 },
    ];

    expect(reconcilePortfolio(buildRepository(data))).toEqual([]);
  });

  it("uses the median annualised expenditure as the representative amount", () => {
    const periods = reconcilePortfolio(buildRepository(portfolioData()));
    const expected = (5_000 * (365.2425 / 29) + 6_000 * (365.2425 / 31)) / 2;

    expect(representativeAnnualExpenditure(periods)).toBeCloseTo(expected);
  });

  it("includes complete home equity in net worth and FI progress", () => {
    const data = portfolioData();
    data.accounts = [
      {
        id: "home",
        name: "Home",
        provider: "Owned",
        currency: "GBP",
        assetType: "property",
        expectedAnnualReturn: 0.03,
        createdAt: "2024-01-01",
      },
      {
        id: "mortgage",
        name: "Mortgage",
        provider: "Lender",
        currency: "GBP",
        assetType: "mortgage",
        expectedAnnualReturn: 0.04,
        linkedAccountId: "home",
        createdAt: "2024-01-01",
      },
    ];
    data.snapshots = [
      { accountId: "home", date: "2024-01-31", balance: 300_000 },
      { accountId: "mortgage", date: "2024-01-31", balance: -200_000 },
      { accountId: "home", date: "2024-02-29", balance: 300_000 },
      { accountId: "mortgage", date: "2024-02-29", balance: -200_000 },
    ];
    data.capitalFlows = [];
    data.incomeHistory = [{ date: "2024-02-29", amount: 3_200 }];
    const repository = buildRepository(data);
    const currentNetWorth =
      getNetWorthTimeSeries(repository).at(-1)?.total ?? 0;
    const result = getPortfolioFinancialIndependence(repository);

    expect(currentNetWorth).toBe(100_000);
    expect(result.progress).toBeGreaterThan(0);
  });
});
