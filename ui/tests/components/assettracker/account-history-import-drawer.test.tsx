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

  it("shows every invalid source row and selects it in the textarea", async () => {
    const user = userEvent.setup();
    render(<AccountHistoryImportDrawer account={account} />);

    await user.click(screen.getByRole("button", { name: "Paste history" }));
    const textarea = screen.getByLabelText(
      "Balance / market value",
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: {
        value:
          "date\tvalue\n2024-01-01\t100\nwrong-date\t200\n2024-01-03\t300\n2024-01-04\t400\n2024-01-05\t500\n2024-01-06\t600\n2024-01-07\t700\n2024-01-08\t800\n2024-01-09\t900\n2024-01-10\t1000\nalso-wrong\t1100",
      },
    });

    expect(screen.getByText(/2 balance rows need attention/)).toBeVisible();
    expect(
      screen.getByText(/wrong-date\s+200/, { selector: "code" }),
    ).toBeVisible();
    expect(
      screen.getByText(/also-wrong\s+1100/, { selector: "code" }),
    ).toBeVisible();
    const lineNumbers = document.getElementById(
      "balance-history-stocks-isa-line-numbers",
    );
    textarea.scrollTop = 40;
    fireEvent.scroll(textarea);
    expect(lineNumbers?.scrollTop).toBe(40);

    fireEvent.click(
      screen.getByRole("button", {
        name: /Line 3: Use YYYY-MM-DD or DD\/MM\/YYYY/,
      }),
    );
    expect(
      textarea.value.slice(textarea.selectionStart, textarea.selectionEnd),
    ).toBe("wrong-date\t200");

    fireEvent.click(
      screen.getByRole("button", {
        name: /Line 12: Use YYYY-MM-DD or DD\/MM\/YYYY/,
      }),
    );
    expect(textarea).toHaveFocus();
    expect(
      textarea.value.slice(textarea.selectionStart, textarea.selectionEnd),
    ).toBe("also-wrong\t1100");
    expect(textarea.scrollTop).toBeGreaterThan(0);
    expect(lineNumbers).toHaveTextContent("12");
    expect(lineNumbers?.scrollTop).toBe(textarea.scrollTop);
  });

  it("keeps a large paste inside a bounded editor with visible actions", async () => {
    const user = userEvent.setup();
    render(<AccountHistoryImportDrawer account={account} />);

    await user.click(screen.getByRole("button", { name: "Paste history" }));
    const textarea = screen.getByLabelText("Balance / market value");
    const rows = Array.from(
      { length: 214 },
      (_, index) => `${2000 + index}-1-1\t${index + 1}`,
    ).join("\n");
    fireEvent.change(textarea, { target: { value: rows } });

    expect(screen.getByText(/214 balance rows ready/)).toBeVisible();
    expect(textarea.parentElement).toHaveClass("h-52", "overflow-hidden");
    expect(textarea).toHaveClass("h-full", "resize-none", "overflow-auto");
    expect(document.querySelector('[data-slot="drawer-content"]')).toHaveClass(
      "h-[92dvh]",
      "overflow-hidden",
    );
    expect(
      screen.getByRole("form", { name: "Import history for Stocks ISA" }),
    ).toHaveClass("min-h-0", "flex-1", "overflow-hidden");
    expect(
      document.querySelector('[data-slot="history-import-actions"]'),
    ).toContainElement(screen.getByRole("button", { name: "Import 214 rows" }));
  });
});
