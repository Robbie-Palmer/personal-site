import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountHistoryImportDrawer } from "@/components/assettracker/account-history-import-drawer";
import { useAssetTracker } from "@/components/assettracker/asset-tracker-provider";
import type { AccountDetailView } from "@/lib/domain/assettracker";

vi.mock("@/components/assettracker/asset-tracker-provider", () => ({
  useAssetTracker: vi.fn(),
}));

const mockUseAssetTracker = vi.mocked(useAssetTracker);
const account: AccountDetailView = {
  id: "stocks-isa",
  name: "Stocks ISA",
  provider: "Vanguard",
  currency: "GBP",
  assetType: "stocks",
  expectedAnnualReturn: 0.07,
  isOpen: true,
  latestBalance: 12000,
  latestSnapshotDate: "2024-06-01",
  cagr: null,
  createdAt: "2023-01-01",
  snapshots: [{ date: "2024-06-01", balance: 12000 }],
  capitalFlows: [],
  netContributed: null,
  gainLoss: null,
};

describe("AccountHistoryImportDrawer", () => {
  const importAccountHistory = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAssetTracker.mockReturnValue({
      importAccountHistory,
    } as unknown as ReturnType<typeof useAssetTracker>);
  });

  it("previews and imports pasted balances and capital flows together", async () => {
    const user = userEvent.setup();
    render(<AccountHistoryImportDrawer account={account} />);

    await user.click(screen.getByRole("button", { name: "Paste history" }));
    fireEvent.change(screen.getByLabelText("Balance / market value"), {
      target: { value: "date,value\n2024-01-31,10000" },
    });
    fireEvent.change(screen.getByLabelText("Deposits / withdrawals"), {
      target: { value: "date,value\n2024-01-31,8000\n2024-02-29,500" },
    });

    expect(screen.getByText(/1 balance row ready/)).toBeInTheDocument();
    expect(screen.getByText(/2 capital flow rows ready/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Import 3 rows" }));

    await waitFor(() =>
      expect(importAccountHistory).toHaveBeenCalledWith({
        accountId: "stocks-isa",
        balances: [{ date: "2024-01-31", value: 10000 }],
        capitalFlows: [
          { date: "2024-01-31", value: 8000 },
          { date: "2024-02-29", value: 500 },
        ],
      }),
    );
  });

  it("blocks an import containing malformed rows", async () => {
    const user = userEvent.setup();
    render(<AccountHistoryImportDrawer account={account} />);

    await user.click(screen.getByRole("button", { name: "Paste history" }));
    fireEvent.change(screen.getByLabelText("Balance / market value"), {
      target: { value: "not-a-date,100" },
    });

    expect(screen.getByText(/Use YYYY-MM-DD/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Import history" }),
    ).toBeDisabled();
    expect(importAccountHistory).not.toHaveBeenCalled();
  });
});
