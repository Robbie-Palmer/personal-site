import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAssetTracker } from "@/components/assettracker/asset-tracker-provider";
import {
  buildFlowSankeyData,
  FlowSankeyChart,
} from "@/components/assettracker/flow-sankey-chart";
import { PortfolioGoal } from "@/components/assettracker/portfolio-goal";
import { UpcomingFlows } from "@/components/assettracker/upcoming-flows";
import { todayIsoDate } from "@/lib/domain/assettracker";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  Sankey: ({ align }: { align?: string }) => (
    <div data-align={align} data-testid="flow-sankey" />
  ),
  Tooltip: () => null,
}));

vi.mock("@/components/assettracker/asset-tracker-provider", () => ({
  useAssetTracker: vi.fn(),
}));

const mockUseAssetTracker = vi.mocked(useAssetTracker);

function mockAssetTracker(
  overrides: Partial<ReturnType<typeof useAssetTracker>> = {},
) {
  mockUseAssetTracker.mockReturnValue({
    accounts: [],
    accountDetails: [],
    netWorthData: [],
    assetAllocation: [],
    transfers: [],
    recurringFlows: [],
    portfolioReturn: null,
    inflation: 0.025,
    netWorthTarget: null,
    netWorthTargetIsReal: false,
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
    setNetWorthTarget: vi.fn(),
    resetData: vi.fn(),
    exportData: vi.fn(),
    exportCsv: vi.fn(),
    importData: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useAssetTracker>);
}

describe("PortfolioGoal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts whole-number goals that are not offset from the minimum", async () => {
    const setNetWorthTarget = vi.fn().mockResolvedValue(undefined);
    mockAssetTracker({ setNetWorthTarget });

    render(<PortfolioGoal />);

    const input = screen.getByLabelText("Target net worth") as HTMLInputElement;
    await userEvent.type(input, "500000");

    expect(input).toHaveAttribute("step", "any");
    expect(input.validity.stepMismatch).toBe(false);
    expect(input.checkValidity()).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Set goal" }));

    expect(setNetWorthTarget).toHaveBeenCalledWith(500000, true);
  });

  it("uses constrained mobile layout classes", () => {
    mockAssetTracker();

    const { container } = render(<PortfolioGoal />);

    expect(container.querySelector('[data-slot="card"]')).toHaveClass(
      "min-w-0",
    );
    expect(screen.getByRole("button", { name: "Set goal" })).toHaveClass(
      "w-full",
      "sm:w-auto",
    );
  });
});

describe("UpcomingFlows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps upcoming rows narrow-first on mobile", () => {
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

describe("FlowSankeyChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps direct account allocations in their natural Sankey layer", () => {
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

    expect(screen.getByTestId("flow-sankey")).toHaveAttribute(
      "data-align",
      "left",
    );
  });
});

describe("buildFlowSankeyData", () => {
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
});
