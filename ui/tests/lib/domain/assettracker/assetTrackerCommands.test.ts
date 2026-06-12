import { describe, expect, it } from "vitest";
import {
  AssetTrackerCommandError,
  applyCloseAccount,
  applyCreateAccount,
  applyDeleteSnapshot,
  applyRecordBalance,
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
      { accountId: "old-pension", date: "2023-06-30", balance: 0 },
    ],
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
    expect(data.accounts).toHaveLength(3);
    expect(data.snapshots).toHaveLength(3);
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

    expect(next.snapshots).toHaveLength(4);
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

    expect(next.snapshots).toHaveLength(3);
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

  it("rejects a negative balance", () => {
    expect(() =>
      applyRecordBalance(baseData(), {
        accountId: "stocks-isa",
        date: "2024-01-01",
        balance: -1,
      }),
    ).toThrow();
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
});

describe("applyDeleteSnapshot", () => {
  it("removes the matching snapshot", () => {
    const next = applyDeleteSnapshot(baseData(), {
      accountId: "stocks-isa",
      date: "2024-06-01",
    });

    expect(next.snapshots).toHaveLength(2);
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
