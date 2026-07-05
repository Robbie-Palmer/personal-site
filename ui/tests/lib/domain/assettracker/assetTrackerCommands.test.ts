import { describe, expect, it } from "vitest";
import {
  AssetTrackerCommandError,
  applyAddRecurringFlow,
  applyCloseAccount,
  applyCreateAccount,
  applyDeleteRecurringFlow,
  applyDeleteSnapshot,
  applyMaterializeFlow,
  applyRecordBalance,
  applyRecordTransfer,
  applySetExpectedReturn,
  applySetNetWorthTarget,
} from "@/lib/domain/assettracker/assetTrackerCommands";
import type { AssetTrackerData } from "@/lib/domain/assettracker/assetTrackerData";
import { flowOccurrenceDates } from "@/lib/domain/assettracker/recurringFlow";

function baseData(): AssetTrackerData {
  return {
    accounts: [
      {
        id: "stocks-isa",
        name: "Stocks ISA",
        provider: "Vanguard",
        currency: "GBP",
        assetType: "stocks",
        expectedAnnualReturn: 0.07,
        createdAt: "2023-01-15",
      },
      {
        id: "savings",
        name: "Savings",
        provider: "Marcus",
        currency: "GBP",
        assetType: "cash",
        expectedAnnualReturn: 0.04,
        createdAt: "2022-01-01",
      },
      {
        id: "credit-card",
        name: "Credit Card",
        provider: "Amex",
        currency: "GBP",
        assetType: "debt",
        expectedAnnualReturn: 0.249,
        createdAt: "2022-01-01",
      },
      {
        id: "old-pension",
        name: "Old Pension",
        provider: "Aviva",
        currency: "GBP",
        assetType: "stocks",
        expectedAnnualReturn: 0.06,
        createdAt: "2018-01-01",
        closedAt: "2023-06-30",
      },
    ],
    snapshots: [
      { accountId: "stocks-isa", date: "2024-01-01", balance: 10000 },
      { accountId: "stocks-isa", date: "2024-06-01", balance: 12000 },
      { accountId: "savings", date: "2024-06-01", balance: 5000 },
      { accountId: "credit-card", date: "2024-06-01", balance: -800 },
      { accountId: "old-pension", date: "2023-06-30", balance: 0 },
    ],
    transfers: [],
    recurringFlows: [],
    settings: { expectedAnnualInflation: 0.025 },
  };
}

describe("applyCreateAccount", () => {
  it("creates an account with a slugified ID", () => {
    const { data, account } = applyCreateAccount(baseData(), {
      name: "Marcus Savings",
      provider: "Goldman Sachs",
      currency: "GBP",
      assetType: "cash",
      expectedAnnualReturn: 0.045,
      openingDate: "2024-01-01",
    });

    expect(account.id).toBe("marcus-savings");
    expect(account.createdAt).toBe("2024-01-01");
    expect(data.accounts).toHaveLength(5);
    expect(data.snapshots).toHaveLength(5);
  });

  it("suffixes the ID when the slug is already taken", () => {
    const { account } = applyCreateAccount(baseData(), {
      name: "Stocks ISA",
      provider: "Trading 212",
      currency: "GBP",
      assetType: "stocks",
      expectedAnnualReturn: 0.07,
    });

    expect(account.id).toBe("stocks-isa-2");
  });

  it("records the opening balance as a snapshot", () => {
    const { data, account } = applyCreateAccount(baseData(), {
      name: "Premium Bonds",
      provider: "NS&I",
      currency: "GBP",
      assetType: "cash",
      expectedAnnualReturn: 0.04,
      openingBalance: 5000,
      openingDate: "2024-03-01",
    });

    expect(data.snapshots).toContainEqual({
      accountId: account.id,
      date: "2024-03-01",
      balance: 5000,
    });
  });

  it("links a mortgage to an existing account", () => {
    const { account } = applyCreateAccount(baseData(), {
      name: "Home Mortgage",
      provider: "Nationwide",
      currency: "GBP",
      assetType: "mortgage",
      expectedAnnualReturn: 0.045,
      linkedAccountId: "savings",
    });

    expect(account.linkedAccountId).toBe("savings");
  });

  it("rejects linking to an unknown account", () => {
    expect(() =>
      applyCreateAccount(baseData(), {
        name: "Home Mortgage",
        provider: "Nationwide",
        currency: "GBP",
        assetType: "mortgage",
        expectedAnnualReturn: 0.045,
        linkedAccountId: "ghost",
      }),
    ).toThrow(/Account not found/);
  });

  it("rejects an empty name", () => {
    expect(() =>
      applyCreateAccount(baseData(), {
        name: "  ",
        provider: "Anywhere",
        currency: "GBP",
        assetType: "cash",
        expectedAnnualReturn: 0.01,
      }),
    ).toThrow();
  });

  it("rejects a name that produces no slug", () => {
    expect(() =>
      applyCreateAccount(baseData(), {
        name: "!!!",
        provider: "Anywhere",
        currency: "GBP",
        assetType: "cash",
        expectedAnnualReturn: 0.01,
      }),
    ).toThrow(AssetTrackerCommandError);
  });

  it("does not mutate the input data", () => {
    const data = baseData();
    applyCreateAccount(data, {
      name: "New Account",
      provider: "Provider",
      currency: "GBP",
      assetType: "cash",
      expectedAnnualReturn: 0.02,
      openingBalance: 100,
    });

    expect(data).toEqual(baseData());
  });
});

describe("applyRecordBalance", () => {
  it("appends a new snapshot", () => {
    const next = applyRecordBalance(baseData(), {
      accountId: "stocks-isa",
      date: "2024-12-01",
      balance: 13500,
    });

    expect(next.snapshots).toHaveLength(6);
    expect(next.snapshots).toContainEqual({
      accountId: "stocks-isa",
      date: "2024-12-01",
      balance: 13500,
    });
  });

  it("replaces an existing snapshot for the same account and date", () => {
    const next = applyRecordBalance(baseData(), {
      accountId: "stocks-isa",
      date: "2024-06-01",
      balance: 12345,
    });

    expect(next.snapshots).toHaveLength(5);
    expect(next.snapshots).toContainEqual({
      accountId: "stocks-isa",
      date: "2024-06-01",
      balance: 12345,
    });
  });

  it("rejects an unknown account", () => {
    expect(() =>
      applyRecordBalance(baseData(), {
        accountId: "ghost",
        date: "2024-01-01",
        balance: 100,
      }),
    ).toThrow(/Account not found/);
  });

  it("rejects a balance after the account closed", () => {
    expect(() =>
      applyRecordBalance(baseData(), {
        accountId: "old-pension",
        date: "2024-01-01",
        balance: 100,
      }),
    ).toThrow(/closed on 2023-06-30/);
  });

  it("allows backfilling history before the closure date", () => {
    const next = applyRecordBalance(baseData(), {
      accountId: "old-pension",
      date: "2022-01-01",
      balance: 15000,
    });

    expect(next.snapshots).toContainEqual({
      accountId: "old-pension",
      date: "2022-01-01",
      balance: 15000,
    });
  });

  it("allows negative balances for liabilities", () => {
    const next = applyRecordBalance(baseData(), {
      accountId: "credit-card",
      date: "2024-12-01",
      balance: -1500,
    });

    expect(next.snapshots).toContainEqual({
      accountId: "credit-card",
      date: "2024-12-01",
      balance: -1500,
    });
  });
});

describe("applyRecordTransfer", () => {
  it("decreases the source and increases the destination", () => {
    const next = applyRecordTransfer(baseData(), {
      date: "2024-07-01",
      fromAccountId: "savings",
      toAccountId: "stocks-isa",
      amount: 1000,
    });

    expect(next.snapshots).toContainEqual({
      accountId: "savings",
      date: "2024-07-01",
      balance: 4000,
    });
    expect(next.snapshots).toContainEqual({
      accountId: "stocks-isa",
      date: "2024-07-01",
      balance: 13000,
    });
    expect(next.transfers).toHaveLength(1);
    expect(next.transfers[0]).toMatchObject({
      fromAccountId: "savings",
      toAccountId: "stocks-isa",
      amount: 1000,
    });
  });

  it("supports external income with no source account", () => {
    const next = applyRecordTransfer(baseData(), {
      date: "2024-07-01",
      toAccountId: "savings",
      amount: 250,
    });

    expect(next.snapshots).toContainEqual({
      accountId: "savings",
      date: "2024-07-01",
      balance: 5250,
    });
  });

  it("pays down a debt balance towards zero", () => {
    const next = applyRecordTransfer(baseData(), {
      date: "2024-07-01",
      fromAccountId: "savings",
      toAccountId: "credit-card",
      amount: 800,
    });

    expect(next.snapshots).toContainEqual({
      accountId: "credit-card",
      date: "2024-07-01",
      balance: 0,
    });
  });

  it("rejects a transfer with neither side", () => {
    expect(() =>
      applyRecordTransfer(baseData(), { date: "2024-07-01", amount: 100 }),
    ).toThrow(/source or a destination/);
  });

  it("rejects a transfer into a closed account", () => {
    expect(() =>
      applyRecordTransfer(baseData(), {
        date: "2024-07-01",
        toAccountId: "old-pension",
        amount: 100,
      }),
    ).toThrow(/closed/);
  });
});

describe("flowOccurrenceDates", () => {
  const monthly = {
    id: "f",
    name: "Monthly",
    toAccountId: "savings",
    amount: 100,
    frequency: "monthly" as const,
    startDate: "2024-01-15",
  };

  it("lists each due date through the cutoff", () => {
    expect(flowOccurrenceDates(monthly, "2024-04-01")).toEqual([
      "2024-01-15",
      "2024-02-15",
      "2024-03-15",
    ]);
  });

  it("honours an end date", () => {
    expect(
      flowOccurrenceDates({ ...monthly, endDate: "2024-02-20" }, "2024-06-01"),
    ).toEqual(["2024-01-15", "2024-02-15"]);
  });

  it("only returns occurrences after a given date", () => {
    expect(flowOccurrenceDates(monthly, "2024-05-01", "2024-02-15")).toEqual([
      "2024-03-15",
      "2024-04-15",
    ]);
  });

  it("steps weekly", () => {
    expect(
      flowOccurrenceDates(
        { ...monthly, frequency: "weekly", startDate: "2024-01-01" },
        "2024-01-22",
      ),
    ).toEqual(["2024-01-01", "2024-01-08", "2024-01-15", "2024-01-22"]);
  });
});

describe("applyMaterializeFlow", () => {
  function withSalaryFlow(): AssetTrackerData {
    return applyAddRecurringFlow(baseData(), {
      name: "Salary",
      toAccountId: "savings",
      amount: 1000,
      frequency: "monthly",
      startDate: "2024-06-01",
    });
  }

  it("turns a flow's due payments into real transfers and balances", () => {
    const next = applyMaterializeFlow(withSalaryFlow(), {
      flowId: "salary",
      throughDate: "2024-08-15",
    });

    const salaryTransfers = next.transfers.filter((t) => t.flowId === "salary");
    expect(salaryTransfers.map((t) => t.date)).toEqual([
      "2024-06-01",
      "2024-07-01",
      "2024-08-01",
    ]);
    // Savings started at 5,000 (2024-06-01); three £1,000 credits land
    expect(next.snapshots).toContainEqual({
      accountId: "savings",
      date: "2024-08-01",
      balance: 8000,
    });
  });

  it("only tops up newly-due periods when re-run", () => {
    const once = applyMaterializeFlow(withSalaryFlow(), {
      flowId: "salary",
      throughDate: "2024-07-15",
    });
    const twice = applyMaterializeFlow(once, {
      flowId: "salary",
      throughDate: "2024-09-15",
    });

    const dates = twice.transfers
      .filter((t) => t.flowId === "salary")
      .map((t) => t.date);
    // No duplicates for June/July, and August/September added
    expect(dates).toEqual([
      "2024-06-01",
      "2024-07-01",
      "2024-08-01",
      "2024-09-01",
    ]);
  });

  it("pays a formula debt down and stops once it's cleared", () => {
    let data = applyAddRecurringFlow(baseData(), {
      name: "Card payment",
      fromAccountId: "savings",
      toAccountId: "credit-card",
      formula: { kind: "minimumPayment", percentOfBalance: 0.5, floor: 100 },
      frequency: "monthly",
      startDate: "2024-07-01",
    });
    // Card owes 800 at 2024-06-01
    data = applyMaterializeFlow(data, {
      flowId: "card-payment",
      throughDate: "2025-07-01",
    });

    const card = data.snapshots
      .filter((s) => s.accountId === "credit-card")
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1);
    // Debt is fully cleared, never overpaid past zero
    expect(card?.balance).toBe(0);
  });

  it("rejects an unknown flow", () => {
    expect(() =>
      applyMaterializeFlow(baseData(), {
        flowId: "ghost",
        throughDate: "2024-12-01",
      }),
    ).toThrow(/No recurring flow/);
  });
});

describe("applyCloseAccount", () => {
  it("sets closedAt and records a final zero balance", () => {
    const next = applyCloseAccount(baseData(), {
      accountId: "stocks-isa",
      closedAt: "2025-01-01",
    });

    const account = next.accounts.find((a) => a.id === "stocks-isa");
    expect(account?.closedAt).toBe("2025-01-01");
    expect(next.snapshots).toContainEqual({
      accountId: "stocks-isa",
      date: "2025-01-01",
      balance: 0,
    });
  });

  it("rejects closing an already closed account", () => {
    expect(() =>
      applyCloseAccount(baseData(), {
        accountId: "old-pension",
        closedAt: "2025-01-01",
      }),
    ).toThrow(/already closed/);
  });

  it("transfers the remaining balance before closing", () => {
    const next = applyCloseAccount(baseData(), {
      accountId: "savings",
      closedAt: "2025-01-01",
      transferToAccountId: "stocks-isa",
    });

    const savings = next.accounts.find((a) => a.id === "savings");
    expect(savings?.closedAt).toBe("2025-01-01");
    // Savings ends at zero, ISA receives the £5,000
    expect(next.snapshots).toContainEqual({
      accountId: "savings",
      date: "2025-01-01",
      balance: 0,
    });
    expect(next.snapshots).toContainEqual({
      accountId: "stocks-isa",
      date: "2025-01-01",
      balance: 17000,
    });
    expect(next.transfers).toHaveLength(1);
  });

  it("rejects transferring the balance to the account being closed", () => {
    expect(() =>
      applyCloseAccount(baseData(), {
        accountId: "savings",
        closedAt: "2025-01-01",
        transferToAccountId: "savings",
      }),
    ).toThrow();
  });

  it("rejects closing before a later recorded balance", () => {
    // savings has a snapshot on 2024-06-01; closing earlier would strand it
    expect(() =>
      applyCloseAccount(baseData(), {
        accountId: "savings",
        closedAt: "2024-01-01",
      }),
    ).toThrow(/recorded after/);
  });

  it("does not overwrite a balance already recorded on the close date", () => {
    // User logs £5,000 on 2024-06-01, then closes that same day
    const next = applyCloseAccount(baseData(), {
      accountId: "savings",
      closedAt: "2024-06-01",
    });

    const account = next.accounts.find((a) => a.id === "savings");
    expect(account?.closedAt).toBe("2024-06-01");
    // The recorded £5,000 survives rather than being clobbered with £0
    expect(next.snapshots).toContainEqual({
      accountId: "savings",
      date: "2024-06-01",
      balance: 5000,
    });
  });
});

describe("applyAddRecurringFlow / applyDeleteRecurringFlow", () => {
  it("adds a fixed flow with a slugified ID", () => {
    const next = applyAddRecurringFlow(baseData(), {
      name: "ISA contribution",
      fromAccountId: "savings",
      toAccountId: "stocks-isa",
      amount: 500,
      frequency: "monthly",
      startDate: "2024-07-01",
    });

    expect(next.recurringFlows).toHaveLength(1);
    expect(next.recurringFlows[0]).toMatchObject({
      id: "isa-contribution",
      amount: 500,
      frequency: "monthly",
    });
  });

  it("adds a minimum payment formula flow", () => {
    const next = applyAddRecurringFlow(baseData(), {
      name: "Card minimum payment",
      fromAccountId: "savings",
      toAccountId: "credit-card",
      formula: { kind: "minimumPayment", percentOfBalance: 0.025, floor: 25 },
      frequency: "monthly",
      startDate: "2024-07-01",
    });

    expect(next.recurringFlows[0]?.formula).toEqual({
      kind: "minimumPayment",
      percentOfBalance: 0.025,
      floor: 25,
    });
  });

  it("rejects a flow with neither amount nor formula", () => {
    expect(() =>
      applyAddRecurringFlow(baseData(), {
        name: "Mystery flow",
        toAccountId: "savings",
        frequency: "monthly",
      }),
    ).toThrow(/amount or a formula/);
  });

  it("deletes a flow and rejects unknown IDs", () => {
    const withFlow = applyAddRecurringFlow(baseData(), {
      name: "Salary",
      toAccountId: "savings",
      amount: 3000,
      frequency: "monthly",
    });

    const next = applyDeleteRecurringFlow(withFlow, { id: "salary" });
    expect(next.recurringFlows).toHaveLength(0);
    expect(() => applyDeleteRecurringFlow(next, { id: "salary" })).toThrow(
      /No recurring flow/,
    );
  });
});

describe("applySetNetWorthTarget", () => {
  it("sets and clears the target while preserving other settings", () => {
    const withTarget = applySetNetWorthTarget(baseData(), { target: 500000 });
    expect(withTarget.settings.targetNetWorth).toBe(500000);
    expect(withTarget.settings.targetNetWorthIsReal).toBe(false);
    expect(withTarget.settings.expectedAnnualInflation).toBe(0.025);

    const cleared = applySetNetWorthTarget(withTarget, { target: null });
    expect(cleared.settings.targetNetWorth).toBeUndefined();
    expect(cleared.settings.targetNetWorthIsReal).toBeUndefined();
  });

  it("records that a target is in today's money", () => {
    const next = applySetNetWorthTarget(baseData(), {
      target: 500000,
      inTodaysMoney: true,
    });

    expect(next.settings.targetNetWorth).toBe(500000);
    expect(next.settings.targetNetWorthIsReal).toBe(true);
  });

  it("rejects a non-positive target", () => {
    expect(() =>
      applySetNetWorthTarget(baseData(), { target: -100 }),
    ).toThrow();
  });
});

describe("applySetExpectedReturn", () => {
  it("records a rate change effective from a date", () => {
    const next = applySetExpectedReturn(baseData(), {
      accountId: "savings",
      rate: 0.05,
      effectiveFrom: "2024-08-01",
    });

    const savings = next.accounts.find((a) => a.id === "savings");
    expect(savings?.expectedReturnChanges).toEqual([
      { date: "2024-08-01", rate: 0.05 },
    ]);
    // The base rate is untouched — history before the change still uses it
    expect(savings?.expectedAnnualReturn).toBe(0.04);
  });

  it("replaces a change on the same date and keeps changes sorted", () => {
    let data = applySetExpectedReturn(baseData(), {
      accountId: "savings",
      rate: 0.05,
      effectiveFrom: "2024-08-01",
    });
    data = applySetExpectedReturn(data, {
      accountId: "savings",
      rate: 0.03,
      effectiveFrom: "2024-02-01",
    });
    data = applySetExpectedReturn(data, {
      accountId: "savings",
      rate: 0.045,
      effectiveFrom: "2024-08-01",
    });

    const savings = data.accounts.find((a) => a.id === "savings");
    expect(savings?.expectedReturnChanges).toEqual([
      { date: "2024-02-01", rate: 0.03 },
      { date: "2024-08-01", rate: 0.045 },
    ]);
  });
});

describe("applyDeleteSnapshot", () => {
  it("removes the matching snapshot", () => {
    const next = applyDeleteSnapshot(baseData(), {
      accountId: "stocks-isa",
      date: "2024-06-01",
    });

    expect(next.snapshots).toHaveLength(4);
    expect(
      next.snapshots.find(
        (s) => s.accountId === "stocks-isa" && s.date === "2024-06-01",
      ),
    ).toBeUndefined();
  });

  it("rejects when no snapshot matches", () => {
    expect(() =>
      applyDeleteSnapshot(baseData(), {
        accountId: "stocks-isa",
        date: "1999-01-01",
      }),
    ).toThrow(/No balance recorded/);
  });
});
