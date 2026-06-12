import { describe, expect, it } from "vitest";
import {
  AssetTrackerCommandError,
  applyAddRecurringFlow,
  applyCloseAccount,
  applyCreateAccount,
  applyDeleteRecurringFlow,
  applyDeleteSnapshot,
  applyRecordBalance,
  applyRecordTransfer,
  applySetExpectedReturn,
} from "@/lib/domain/assettracker/assetTrackerCommands";
import type { AssetTrackerData } from "@/lib/domain/assettracker/assetTrackerData";

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
