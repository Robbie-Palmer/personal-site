import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAssetTracker } from "@/components/assettracker/asset-tracker-provider";
import { DataControls } from "@/components/assettracker/data-controls";

vi.mock("@/components/assettracker/asset-tracker-provider", () => ({
  useAssetTracker: vi.fn(),
}));

const mockUseAssetTracker = vi.mocked(useAssetTracker);

describe("DataControls", () => {
  const clearData = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAssetTracker.mockReturnValue({
      hasLocalChanges: false,
      inflation: 0.025,
      setInflation: vi.fn(),
      exportData: vi.fn(),
      exportCsv: vi.fn(),
      importData: vi.fn(),
      clearData,
      resetData: vi.fn(),
    } as unknown as ReturnType<typeof useAssetTracker>);
  });

  it("offers a confirmed path from demo data to a blank tracker", async () => {
    const user = userEvent.setup();
    render(<DataControls />);

    await user.click(screen.getByRole("button", { name: "Clear demo data" }));
    expect(clearData).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Clear demo data?" }));
    expect(clearData).toHaveBeenCalledOnce();
  });
});
