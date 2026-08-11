import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAssetTracker } from "@/components/assettracker/asset-tracker-provider";
import { IncomeHistoryImportDrawer } from "@/components/assettracker/income-history-import-drawer";

vi.mock("@/components/assettracker/asset-tracker-provider", () => ({
  useAssetTracker: vi.fn(),
}));

const mockUseAssetTracker = vi.mocked(useAssetTracker);

describe("IncomeHistoryImportDrawer", () => {
  const importIncomeHistory = vi.fn().mockResolvedValue(undefined);
  const clearIncomeHistory = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAssetTracker.mockReturnValue({
      incomeHistory: [],
      importIncomeHistory,
      clearIncomeHistory,
    } as unknown as ReturnType<typeof useAssetTracker>);
  });

  it("imports sorted portfolio income rows and accepts an income header", async () => {
    render(<IncomeHistoryImportDrawer />);

    fireEvent.click(screen.getByRole("button", { name: "Add income history" }));
    fireEvent.change(screen.getByLabelText("Period end and income"), {
      target: {
        value: "date,income\n2025-02-28,4200\n2025-01-31,4100",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import 2 periods" }));

    expect(importIncomeHistory).toHaveBeenCalledWith({
      income: [
        { date: "2025-01-31", amount: 4100 },
        { date: "2025-02-28", amount: 4200 },
      ],
    });
  });

  it("can clear an existing income series", async () => {
    mockUseAssetTracker.mockReturnValue({
      incomeHistory: [{ date: "2025-01-31", amount: 4100 }],
      importIncomeHistory,
      clearIncomeHistory,
    } as unknown as ReturnType<typeof useAssetTracker>);
    render(<IncomeHistoryImportDrawer />);

    fireEvent.click(
      screen.getByRole("button", { name: "Replace income history" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Clear income history" }),
    );

    expect(clearIncomeHistory).toHaveBeenCalledOnce();
  });
});
