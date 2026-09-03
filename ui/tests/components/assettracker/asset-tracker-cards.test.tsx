import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountsTable } from "@/components/assettracker/accounts-table";
import { AssetAllocationHistoryChart } from "@/components/assettracker/asset-allocation-history-chart";
import { useAssetTracker } from "@/components/assettracker/asset-tracker-provider";
import { FlowSankeyChart } from "@/components/assettracker/flow-sankey-chart";
import { PortfolioContributionChart } from "@/components/assettracker/portfolio-contribution-chart";
import { PortfolioGoal } from "@/components/assettracker/portfolio-goal";
import { UpcomingFlows } from "@/components/assettracker/upcoming-flows";
import {
  buildFlowSankeyData,
  type PortfolioFinancialIndependence,
  todayIsoDate,
} from "@/lib/domain/assettracker";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  LineChart: ({ children, data }: { children: ReactNode; data: unknown[] }) => (
    <div data-chart-data={JSON.stringify(data)} data-testid="line-chart">
      {children}
    </div>
  ),
  Line: ({ dataKey, dot }: { dataKey: string; dot?: boolean }) => (
    <div
      data-dots={dot === false ? "hidden" : "visible"}
      data-series={dataKey}
    />
  ),
  CartesianGrid: () => null,
  ReferenceLine: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Legend: () => null,
  Sankey: ({ align }: { align?: string }) => (
    <div data-align={align} data-testid="flow-sankey" />
  ),
  Tooltip: () => null,
}));

vi.mock("@/components/assettracker/asset-tracker-provider", () => ({
  useAssetTracker: vi.fn(),
}));

const mockUseAssetTracker = vi.mocked(useAssetTracker);
const FIXED_NOW = new Date("2026-07-03T12:00:00+01:00");
const EMPTY_FI: PortfolioFinancialIndependence = {
  periods: [],
  representativeAnnualExpenditure: null,
  representativeAnnualCurrentExpenditure: null,
  representativeAnnualSavings: null,
  savingsRate: null,
  takeHomeSavingsRate: null,
  currentCompensation: null,
  emergencyFund: 0,
  emergencyFundMonths: null,
  target: null,
  progress: null,
  expectedRealReturn: null,
  projection: [],
  projectedFiDate: null,
  yearsToFi: null,
};

function mockAssetTracker(
  overrides: Partial<ReturnType<typeof useAssetTracker>> = {},
) {
  mockUseAssetTracker.mockReturnValue({
    accounts: [],
    accountDetails: [],
    netWorthData: [],
    contributionData: [],
    assetAllocation: [],
    assetAllocationHistory: [],
    transfers: [],
    recurringFlows: [],
    incomeHistory: [],
    financialIndependence: EMPTY_FI,
    portfolioReturn: null,
    inflation: 0.025,
    netWorthTarget: null,
    netWorthTargetIsReal: false,
    withdrawalRate: 0.04,
    hasLocalChanges: false,
    createAccount: vi.fn(),
    recordBalance: vi.fn(),
    recordTransfer: vi.fn(),
    closeAccount: vi.fn(),
    deleteSnapshot: vi.fn(),
    addRecurringFlow: vi.fn(),
    deleteRecurringFlow: vi.fn(),
    materializeFlow: vi.fn(),
    setExpectedReturn: vi.fn(),
    setInflation: vi.fn(),
    setWithdrawalRate: vi.fn(),
    setNetWorthTarget: vi.fn(),
    importIncomeHistory: vi.fn(),
    clearIncomeHistory: vi.fn(),
    resetData: vi.fn(),
    exportData: vi.fn(),
    exportCsv: vi.fn(),
    importData: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useAssetTracker>);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("PortfolioGoal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the withdrawal rate used to derive the FI target", async () => {
    const setWithdrawalRate = vi.fn().mockResolvedValue(undefined);
    mockAssetTracker({ setWithdrawalRate });

    render(<PortfolioGoal />);

    const input = screen.getByLabelText("Withdrawal rate");
    await userEvent.clear(input);
    await userEvent.type(input, "3.5");
    await userEvent.tab();

    expect(setWithdrawalRate).toHaveBeenCalledWith(0.035);
  });

  it("preserves a stored withdrawal rate without persisting on an unchanged blur", async () => {
    const setWithdrawalRate = vi.fn().mockResolvedValue(undefined);
    mockAssetTracker({ withdrawalRate: 0.0355, setWithdrawalRate });

    render(<PortfolioGoal />);

    const input = screen.getByLabelText("Withdrawal rate");
    expect(input).toHaveValue(3.55);
    await userEvent.click(input);
    await userEvent.tab();

    expect(setWithdrawalRate).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range withdrawal rate before saving", async () => {
    const setWithdrawalRate = vi.fn().mockResolvedValue(undefined);
    mockAssetTracker({ setWithdrawalRate });

    render(<PortfolioGoal />);

    const input = screen.getByLabelText("Withdrawal rate");
    await userEvent.clear(input);
    await userEvent.type(input, "0");
    await userEvent.tab();

    expect(setWithdrawalRate).not.toHaveBeenCalled();
    expect(
      screen.getByText("Withdrawal rate must be between 0.1% and 100%"),
    ).toBeVisible();
  });

  it("uses constrained mobile layout classes", () => {
    mockAssetTracker();

    const { container } = render(<PortfolioGoal />);

    expect(container.querySelector('[data-slot="card"]')).toHaveClass(
      "min-w-0",
    );
    expect(
      screen.getByRole("button", { name: "Add income history" }),
    ).toBeVisible();
  });

  it("uses a native progress element for an active goal", () => {
    mockAssetTracker({
      financialIndependence: {
        ...EMPTY_FI,
        periods: [],
        representativeAnnualExpenditure: 20_000,
        target: 500_000,
        progress: 0.25,
      },
    });

    render(<PortfolioGoal />);

    const progress = screen.getByRole("progressbar", {
      name: "Financial independence progress",
    });
    expect(progress.tagName).toBe("PROGRESS");
    expect(progress).toHaveAttribute("max", "1");
    expect(progress).toHaveAttribute("value", "0.25");
  });

  it("plots current and long-term spending and switches to retained income", async () => {
    mockAssetTracker({
      incomeHistory: [
        { date: "2026-01-31", amount: 4_000 },
        { date: "2026-02-28", amount: 4_200 },
      ],
      financialIndependence: {
        ...EMPTY_FI,
        periods: [
          {
            startDate: "2025-12-31",
            endDate: "2026-01-31",
            openingNetWorth: 100_000,
            closingNetWorth: 101_500,
            income: 4_000,
            netCapitalFlow: 1_500,
            personalCapitalFlow: 1_500,
            debtPrincipalFlow: 500,
            externalCapitalFlow: 0,
            retainedIncomeSource: "balance-change",
            valuationGain: 0,
            expenditure: 2_500,
            currentExpenditure: 3_000,
            days: 31,
            annualizedExpenditure: 29_455.04,
            annualizedCurrentExpenditure: 35_346.05,
          },
        ],
        representativeAnnualExpenditure: 29_455.04,
        representativeAnnualCurrentExpenditure: 35_346.05,
        target: 736_376,
        progress: 0.14,
      },
    });

    render(<PortfolioGoal />);

    expect(
      screen.getByRole("img", { name: "Income and spending by period" }),
    ).toBeVisible();
    expect(screen.getByTestId("line-chart")).toHaveAttribute(
      "data-chart-data",
      JSON.stringify([
        {
          date: "2026-01-31",
          income: 4_000,
          expenditure: 2_500,
          currentExpenditure: 3_000,
          difference: 1_500,
        },
        { date: "2026-02-28", income: 4_200 },
      ]),
    );
    expect(document.querySelector('[data-series="income"]')).toBeVisible();
    expect(
      document.querySelector('[data-series="expenditure"]'),
    ).toHaveAttribute("data-dots", "visible");
    expect(
      document.querySelector('[data-series="currentExpenditure"]'),
    ).toHaveAttribute("data-dots", "visible");
    expect(
      screen.getByRole("table", { name: "Income and spending by period" }),
    ).toHaveTextContent(
      "2026-01-31£4,000£2,500£3,000£1,5002026-02-28£4,200Awaiting reconciliationAwaiting reconciliationAwaiting reconciliation",
    );
    expect(screen.getByText("Estimated from balances")).toBeVisible();
    expect(
      screen.getByText("£35,346/yr current spending, including debt principal"),
    ).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Retained" }));

    expect(
      screen.getByRole("img", { name: "Income retained by period" }),
    ).toBeVisible();
    expect(document.querySelector('[data-series="income"]')).toBeNull();
    expect(document.querySelector('[data-series="expenditure"]')).toBeNull();
    expect(
      document.querySelector('[data-series="difference"]'),
    ).toHaveAttribute("data-dots", "visible");
  });

  it("shows emergency runway, savings rate, and a portfolio years-to-FI projection", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    mockAssetTracker({
      financialIndependence: {
        ...EMPTY_FI,
        representativeAnnualExpenditure: 24_000,
        representativeAnnualSavings: 12_000,
        savingsRate: 0.333,
        takeHomeSavingsRate: 0.25,
        currentCompensation: {
          annualTakeHomeIncome: 32_000,
          annualTakeHomeSavings: 8_000,
          annualEmployeePensionContribution: 3_000,
          annualEmployerPensionContribution: 1_000,
        },
        emergencyFund: 9_000,
        emergencyFundMonths: 4.5,
        target: 600_000,
        progress: 0.25,
        expectedRealReturn: 0.04,
        projection: [
          { date: "2026-07-03", projected: 150_000 },
          { date: "2038-07-03", projected: 600_100 },
        ],
        projectedFiDate: "2038-07-03",
        yearsToFi: 12,
      },
    });

    render(<PortfolioGoal />);

    expect(screen.getByText("33.3%")).toBeVisible();
    expect(screen.getByText("All-in savings rate")).toBeVisible();
    expect(screen.getByText(/25.0% from take-home pay/)).toBeVisible();
    expect(screen.getByText(/£3,000 employee pension/)).toBeVisible();
    expect(screen.getByText("£9,000")).toBeVisible();
    expect(screen.getByText("4.5 months without income")).toBeVisible();
    expect(screen.getByText("12.0 years")).toBeVisible();
    expect(screen.getByText("Around Jul 2038")).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: "Projected portfolio net worth against the financial independence target",
      }),
    ).toBeVisible();
  });
});

describe("AssetAllocationHistoryChart", () => {
  it("plots percentage series and exposes an accessible data table", () => {
    render(
      <AssetAllocationHistoryChart
        data={[
          { date: "2025-01-01", totalAssets: 100_000, cash: 0.2, stocks: 0.8 },
          { date: "2026-01-01", totalAssets: 120_000, cash: 0.1, stocks: 0.9 },
        ]}
      />,
    );

    expect(
      screen.getByRole("img", {
        name: "Percentage of assets by asset type over time",
      }),
    ).toBeVisible();
    expect(document.querySelector('[data-series="cash"]')).toBeVisible();
    expect(document.querySelector('[data-series="stocks"]')).toBeVisible();
    expect(
      screen.getByRole("table", {
        name: "Percentage of assets by asset type over time",
      }),
    ).toHaveTextContent("2025-01-0120.0%80.0%2026-01-0110.0%90.0%");
  });
});

describe("PortfolioContributionChart", () => {
  it("plots contributed capital independently of worth and exposes its data", () => {
    render(
      <PortfolioContributionChart
        data={[
          { date: "2025-01-01", contributedCapital: 80_000 },
          { date: "2026-01-01", contributedCapital: 92_500 },
        ]}
      />,
    );

    expect(
      screen.getByRole("img", {
        name: "Cumulative contributed capital over time",
      }),
    ).toBeVisible();
    expect(
      document.querySelector('[data-series="contributedCapital"]'),
    ).toBeVisible();
    expect(
      screen.getByRole("table", {
        name: "Cumulative contributed capital over time",
      }),
    ).toHaveTextContent("2025-01-01£80,0002026-01-01£92,500");
  });

  it("explains how to populate an empty contribution history", () => {
    render(<PortfolioContributionChart data={[]} />);

    expect(
      screen.getByText(/Import an account's “Total contributed to date”/),
    ).toBeVisible();
  });
});

describe("UpcomingFlows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps upcoming rows narrow-first on mobile", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);

    const today = todayIsoDate();
    mockAssetTracker({
      accounts: [
        {
          id: "cash",
          name: "Current account",
          provider: "Bank",
          currency: "GBP",
          assetType: "cash",
          expectedAnnualReturn: 0,
          isOpen: true,
          latestBalance: 1000,
          latestSnapshotDate: today,
          cagr: null,
        },
      ],
      accountDetails: [
        {
          id: "cash",
          name: "Current account",
          provider: "Bank",
          currency: "GBP",
          assetType: "cash",
          expectedAnnualReturn: 0,
          isOpen: true,
          latestBalance: 1000,
          latestSnapshotDate: today,
          cagr: null,
          createdAt: today,
          snapshots: [{ date: today, balance: 1000 }],
          capitalFlows: [],
          netContributed: null,
          gainLoss: null,
        },
      ],
      recurringFlows: [
        {
          id: "salary",
          name: "Salary",
          toAccountId: "cash",
          amount: 2500,
          frequency: "monthly",
          startDate: today,
        },
      ],
    });

    const { container } = render(<UpcomingFlows />);

    expect(container.querySelector('[data-slot="card"]')).toHaveClass(
      "min-w-0",
    );
    const row = screen.getByText("Salary").closest("li");
    expect(row).toHaveClass("grid", "min-w-0", "sm:flex");
    expect(row?.querySelector("span")).toHaveClass("shrink-0", "sm:w-24");
  });
});

describe("AccountsTable", () => {
  it("hides closed accounts until requested", async () => {
    const user = userEvent.setup();
    render(
      <AccountsTable
        accounts={[
          {
            id: "current",
            name: "Current account",
            provider: "Bank",
            currency: "GBP",
            assetType: "cash",
            expectedAnnualReturn: 0.01,
            isOpen: true,
            latestBalance: 2_000,
            latestSnapshotDate: "2026-01-01",
            cagr: null,
            createdAt: "2024-01-01",
            snapshots: [{ date: "2026-01-01", balance: 2_000 }],
            capitalFlows: [],
            netContributed: null,
            gainLoss: null,
          },
          {
            id: "old-fund",
            name: "Old fund",
            provider: "Broker",
            currency: "GBP",
            assetType: "stocks",
            expectedAnnualReturn: 0.05,
            isOpen: false,
            latestBalance: 0,
            latestSnapshotDate: "2025-01-01",
            cagr: null,
            createdAt: "2023-01-01",
            closedAt: "2025-01-01",
            snapshots: [{ date: "2025-01-01", balance: 0 }],
            capitalFlows: [],
            netContributed: null,
            gainLoss: null,
          },
        ]}
      />,
    );

    expect(screen.getByText("Current account")).toBeVisible();
    expect(screen.queryByText("Old fund")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Show closed accounts (1)" }),
    );

    expect(screen.getByText("Old fund")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Hide closed accounts" }),
    ).toHaveAttribute("aria-expanded", "true");
  });
});

describe("FlowSankeyChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes left alignment to the Sankey layout", async () => {
    const today = todayIsoDate();
    mockAssetTracker({
      accountDetails: [
        {
          id: "current",
          name: "Current",
          provider: "Bank",
          currency: "GBP",
          assetType: "cash",
          expectedAnnualReturn: 0,
          isOpen: true,
          latestBalance: 1000,
          latestSnapshotDate: today,
          cagr: null,
          createdAt: today,
          snapshots: [{ date: today, balance: 1000 }],
          capitalFlows: [],
          netContributed: null,
          gainLoss: null,
        },
        {
          id: "isa",
          name: "ISA",
          provider: "Broker",
          currency: "GBP",
          assetType: "stocks",
          expectedAnnualReturn: 0,
          isOpen: true,
          latestBalance: 5000,
          latestSnapshotDate: today,
          cagr: null,
          createdAt: today,
          snapshots: [{ date: today, balance: 5000 }],
          capitalFlows: [],
          netContributed: null,
          gainLoss: null,
        },
      ],
      recurringFlows: [
        {
          id: "isa",
          name: "ISA contribution",
          fromAccountId: "current",
          toAccountId: "isa",
          amount: 500,
          frequency: "monthly",
          startDate: today,
        },
      ],
    });

    render(<FlowSankeyChart />);

    expect(await screen.findByTestId("flow-sankey")).toHaveAttribute(
      "data-align",
      "left",
    );
  });
});

describe("buildFlowSankeyData", () => {
  it("splits gross salary into take-home pay, pension, and tax", () => {
    const data = buildFlowSankeyData(
      [
        {
          id: "current",
          name: "Instant access",
          provider: "Bank",
          currency: "GBP",
          assetType: "cash",
          expectedAnnualReturn: 0,
          isOpen: true,
          latestBalance: 1_000,
          latestSnapshotDate: "2026-07-03",
          cagr: null,
        },
        {
          id: "pension",
          name: "Pension",
          provider: "Provider",
          currency: "GBP",
          assetType: "stocks",
          expectedAnnualReturn: 0,
          isOpen: true,
          latestBalance: 10_000,
          latestSnapshotDate: "2026-07-03",
          cagr: null,
        },
      ],
      [
        {
          id: "salary",
          name: "Take-home salary",
          toAccountId: "current",
          amount: 4_100,
          grossAmount: 6_400,
          compensationKind: "takeHomeIncome",
          frequency: "monthly",
          startDate: "2026-07-01",
        },
        {
          id: "employee-pension",
          name: "Employee pension",
          toAccountId: "pension",
          amount: 900,
          compensationKind: "employeePension",
          frequency: "monthly",
          startDate: "2026-07-01",
        },
        {
          id: "employer-pension",
          name: "Employer pension",
          toAccountId: "pension",
          amount: 350,
          compensationKind: "employerPension",
          frequency: "monthly",
          startDate: "2026-07-01",
        },
      ],
      {},
    );

    expect(data.nodes.map((node) => node.name)).toEqual([
      "External income",
      "Gross pay",
      "Instant access",
      "Pension",
      "Tax and deductions",
    ]);
    expect(data.links).toEqual([
      {
        source: 0,
        target: 1,
        value: 6_400,
        label: "Gross salary",
        sourceName: "External income",
        targetName: "Gross pay",
      },
      {
        source: 1,
        target: 2,
        value: 4_100,
        label: "Take-home salary",
        sourceName: "Gross pay",
        targetName: "Instant access",
      },
      {
        source: 1,
        target: 3,
        value: 900,
        label: "Employee pension",
        sourceName: "Gross pay",
        targetName: "Pension",
      },
      {
        source: 0,
        target: 3,
        value: 350,
        label: "Employer pension",
        sourceName: "External income",
        targetName: "Pension",
      },
      {
        source: 1,
        target: 4,
        value: 1_400,
        label: "Tax and deductions",
        sourceName: "Gross pay",
        targetName: "Tax and deductions",
      },
    ]);
  });

  it("converts regular flows into monthly Sankey links", () => {
    const data = buildFlowSankeyData(
      [
        {
          id: "current",
          name: "Current",
          provider: "Bank",
          currency: "GBP",
          assetType: "cash",
          expectedAnnualReturn: 0,
          isOpen: true,
          latestBalance: 1000,
          latestSnapshotDate: "2026-07-03",
          cagr: null,
        },
        {
          id: "isa",
          name: "ISA",
          provider: "Broker",
          currency: "GBP",
          assetType: "stocks",
          expectedAnnualReturn: 0.07,
          isOpen: true,
          latestBalance: 5000,
          latestSnapshotDate: "2026-07-03",
          cagr: null,
        },
        {
          id: "card",
          name: "Credit Card",
          provider: "Card",
          currency: "GBP",
          assetType: "debt",
          expectedAnnualReturn: 0.2,
          isOpen: true,
          latestBalance: -2000,
          latestSnapshotDate: "2026-07-03",
          cagr: null,
        },
      ],
      [
        {
          id: "salary",
          name: "Salary",
          toAccountId: "current",
          amount: 3200,
          frequency: "monthly",
          startDate: "2026-07-01",
        },
        {
          id: "isa",
          name: "ISA",
          fromAccountId: "current",
          toAccountId: "isa",
          amount: 6000,
          frequency: "yearly",
          startDate: "2026-07-01",
        },
        {
          id: "card",
          name: "Card minimum",
          fromAccountId: "current",
          toAccountId: "card",
          formula: {
            kind: "minimumPayment",
            percentOfBalance: 0.025,
            floor: 25,
          },
          frequency: "monthly",
          startDate: "2026-07-01",
        },
      ],
      { card: -2000 },
    );

    expect(data.nodes.map((node) => node.name)).toEqual([
      "External income",
      "Current",
      "ISA",
      "Credit Card",
      "Expected returns",
      "Interest charged",
    ]);
    expect(data.links).toEqual([
      {
        source: 0,
        target: 1,
        value: 3200,
        label: "Salary",
        sourceName: "External income",
        targetName: "Current",
      },
      {
        source: 1,
        target: 2,
        value: 500,
        label: "ISA",
        sourceName: "Current",
        targetName: "ISA",
      },
      {
        source: 1,
        target: 3,
        value: 50,
        label: "Card minimum",
        sourceName: "Current",
        targetName: "Credit Card",
      },
      {
        source: 4,
        target: 2,
        value: 28.27,
        label: "Expected return",
        sourceName: "Expected returns",
        targetName: "ISA",
      },
      {
        source: 3,
        target: 5,
        value: 30.62,
        label: "Interest charged",
        sourceName: "Credit Card",
        targetName: "Interest charged",
      },
    ]);
  });

  it("splits linked liability repayments into interest and principal flows", () => {
    const data = buildFlowSankeyData(
      [
        {
          id: "current",
          name: "Current",
          provider: "Bank",
          currency: "GBP",
          assetType: "cash",
          expectedAnnualReturn: 0,
          isOpen: true,
          latestBalance: 1000,
          latestSnapshotDate: "2026-07-03",
          cagr: null,
        },
        {
          id: "home",
          name: "Home",
          provider: "Property",
          currency: "GBP",
          assetType: "property",
          expectedAnnualReturn: 0.03,
          isOpen: true,
          latestBalance: 298000,
          latestSnapshotDate: "2026-07-03",
          cagr: null,
        },
        {
          id: "mortgage",
          name: "Home Mortgage",
          provider: "Lender",
          currency: "GBP",
          assetType: "debt",
          expectedAnnualReturn: 0.0425,
          linkedAccountId: "home",
          isOpen: true,
          latestBalance: -212800,
          latestSnapshotDate: "2026-07-03",
          cagr: null,
        },
      ],
      [
        {
          id: "mortgage-payment",
          name: "Mortgage payment",
          fromAccountId: "current",
          toAccountId: "mortgage",
          amount: 1150,
          frequency: "monthly",
          startDate: "2026-07-01",
        },
      ],
      { mortgage: -212800 },
    );

    expect(data.nodes.map((node) => node.name)).toEqual([
      "Current",
      "Home Mortgage",
      "Expected returns",
      "Home",
      "Interest charged",
    ]);
    expect(data.links).toEqual([
      {
        source: 0,
        target: 1,
        value: 1150,
        label: "Mortgage payment",
        sourceName: "Current",
        targetName: "Home Mortgage",
      },
      {
        source: 2,
        target: 3,
        value: 734.95,
        label: "Expected return",
        sourceName: "Expected returns",
        targetName: "Home",
      },
      {
        source: 1,
        target: 4,
        value: 739.37,
        label: "Interest charged",
        sourceName: "Home Mortgage",
        targetName: "Interest charged",
      },
      {
        source: 1,
        target: 3,
        value: 410.63,
        label: "Principal repayment",
        sourceName: "Home Mortgage",
        targetName: "Home",
      },
    ]);
  });

  it("shows expected losses for depreciating assets", () => {
    const data = buildFlowSankeyData(
      [
        {
          id: "car",
          name: "Car",
          provider: "Owned",
          currency: "GBP",
          assetType: "property",
          expectedAnnualReturn: -0.12,
          isOpen: true,
          latestBalance: 10000,
          latestSnapshotDate: "2026-07-03",
          cagr: null,
        },
      ],
      [],
      {},
    );

    expect(data.nodes.map((node) => node.name)).toEqual([
      "Car",
      "Expected losses",
    ]);
    expect(data.links).toEqual([
      {
        source: 0,
        target: 1,
        value: 105.96,
        label: "Expected loss",
        sourceName: "Car",
        targetName: "Expected losses",
      },
    ]);
  });

  it("skips invalid expected return calculations", () => {
    const data = buildFlowSankeyData(
      [
        {
          id: "asset",
          name: "Invalid return asset",
          provider: "Provider",
          currency: "GBP",
          assetType: "stocks",
          expectedAnnualReturn: -1,
          isOpen: true,
          latestBalance: 10000,
          latestSnapshotDate: "2026-07-03",
          cagr: null,
        },
      ],
      [],
      {},
    );

    expect(data).toEqual({ nodes: [], links: [] });
  });

  it("does not create zero-value links after rounding", () => {
    const data = buildFlowSankeyData(
      [
        {
          id: "current",
          name: "Current",
          provider: "Bank",
          currency: "GBP",
          assetType: "cash",
          expectedAnnualReturn: 0,
          isOpen: true,
          latestBalance: 1000,
          latestSnapshotDate: "2026-07-03",
          cagr: null,
        },
        {
          id: "savings",
          name: "Savings",
          provider: "Bank",
          currency: "GBP",
          assetType: "cash",
          expectedAnnualReturn: 0,
          isOpen: true,
          latestBalance: 1000,
          latestSnapshotDate: "2026-07-03",
          cagr: null,
        },
      ],
      [
        {
          id: "dust",
          name: "Dust",
          fromAccountId: "current",
          toAccountId: "savings",
          amount: 0.004,
          frequency: "monthly",
          startDate: "2026-07-01",
        },
      ],
      {},
    );

    expect(data).toEqual({ nodes: [], links: [] });
  });

  it("deduplicates labels when merging equivalent links", () => {
    const data = buildFlowSankeyData(
      [
        {
          id: "current",
          name: "Current",
          provider: "Bank",
          currency: "GBP",
          assetType: "cash",
          expectedAnnualReturn: 0,
          isOpen: true,
          latestBalance: 1000,
          latestSnapshotDate: "2026-07-03",
          cagr: null,
        },
        {
          id: "savings",
          name: "Savings",
          provider: "Bank",
          currency: "GBP",
          assetType: "cash",
          expectedAnnualReturn: 0,
          isOpen: true,
          latestBalance: 1000,
          latestSnapshotDate: "2026-07-03",
          cagr: null,
        },
      ],
      [
        {
          id: "first",
          name: "Transfer",
          fromAccountId: "current",
          toAccountId: "savings",
          amount: 10,
          frequency: "monthly",
          startDate: "2026-07-01",
        },
        {
          id: "second",
          name: "Transfer",
          fromAccountId: "current",
          toAccountId: "savings",
          amount: 5,
          frequency: "monthly",
          startDate: "2026-07-01",
        },
      ],
      {},
    );

    expect(data.links).toEqual([
      {
        source: 0,
        target: 1,
        value: 15,
        label: "Transfer",
        sourceName: "Current",
        targetName: "Savings",
      },
    ]);
  });
});
