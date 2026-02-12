import { describe, expect, it, vi } from "vitest";
import type { AccountContent } from "@/lib/domain/assettracker/account";
import type { BalanceSnapshot } from "@/lib/domain/assettracker/balanceSnapshot";

const accountsMock = vi.hoisted(() => ({
  accounts: [
    {
      id: "isa-1",
      name: "Stocks ISA",
      provider: "Vanguard",
      currency: "GBP",
      assetType: "stocks",
      expectedAnnualReturn: 0.07,
      createdAt: "2023-01-15",
    },
    {
      id: "savings-1",
      name: "Easy Access Savings",
      provider: "Marcus",
      currency: "GBP",
      assetType: "cash",
      expectedAnnualReturn: 0.04,
      createdAt: "2022-06-01",
    },
  ] as AccountContent[],
}));

const snapshotsMock = vi.hoisted(() => ({
  snapshots: [
    { accountId: "isa-1", date: "2024-01-01", balance: 10000 },
    { accountId: "isa-1", date: "2024-06-01", balance: 12000 },
    { accountId: "savings-1", date: "2024-01-01", balance: 5000 },
    { accountId: "savings-1", date: "2024-06-01", balance: 5200 },
  ] as BalanceSnapshot[],
}));

vi.mock("@/content/assettracker/accounts", () => accountsMock);
vi.mock("@/content/assettracker/snapshots", () => snapshotsMock);

import {
  loadAssetTrackerRepository,
  resetRepositoryCache,
} from "@/lib/domain/assettracker/assetTrackerRepository";

describe("AssetTrackerRepository", () => {
  describe("loadAssetTrackerRepository", () => {
    it("loads accounts and snapshots", () => {
      resetRepositoryCache();
      const repo = loadAssetTrackerRepository();

      expect(repo.accounts.size).toBe(2);
      expect(repo.snapshots).toHaveLength(4);
      expect(repo.accounts.has("isa-1")).toBe(true);
      expect(repo.accounts.has("savings-1")).toBe(true);
    });

    it("sorts snapshots by date ascending", () => {
      resetRepositoryCache();
      const repo = loadAssetTrackerRepository();

      const dates = repo.snapshots.map((s) => s.date);
      const sorted = [...dates].sort();
      expect(dates).toEqual(sorted);
    });

    it("returns cached repository on subsequent calls", () => {
      resetRepositoryCache();
      const first = loadAssetTrackerRepository();
      const second = loadAssetTrackerRepository();
      expect(first).toBe(second);
    });

    it("returns fresh repository after cache reset", () => {
      resetRepositoryCache();
      const first = loadAssetTrackerRepository();
      resetRepositoryCache();
      const second = loadAssetTrackerRepository();
      expect(first).not.toBe(second);
      expect(first).toEqual(second);
    });
  });

  describe("validation", () => {
    it("throws on duplicate account IDs", () => {
      accountsMock.accounts = [
        {
          id: "dup-1",
          name: "Account A",
          provider: "ProviderA",
          currency: "GBP",
          assetType: "cash",
          expectedAnnualReturn: 0.03,
          createdAt: "2024-01-01",
        },
        {
          id: "dup-1",
          name: "Account B",
          provider: "ProviderB",
          currency: "GBP",
          assetType: "stocks",
          expectedAnnualReturn: 0.05,
          createdAt: "2024-02-01",
        },
      ] as AccountContent[];
      snapshotsMock.snapshots = [];

      vi.resetModules();
      vi.mock("@/content/assettracker/accounts", () => accountsMock);
      vi.mock("@/content/assettracker/snapshots", () => snapshotsMock);

      return import("@/lib/domain/assettracker/assetTrackerRepository").then(
        ({ loadAssetTrackerRepository: freshLoad }) => {
          expect(() => freshLoad()).toThrow(/Duplicate account ID "dup-1"/);
        },
      );
    });

    it("throws when snapshot references unknown account", () => {
      accountsMock.accounts = [
        {
          id: "real-1",
          name: "Real Account",
          provider: "Provider",
          currency: "GBP",
          assetType: "cash",
          expectedAnnualReturn: 0.03,
          createdAt: "2024-01-01",
        },
      ] as AccountContent[];
      snapshotsMock.snapshots = [
        { accountId: "ghost-account", date: "2024-01-01", balance: 1000 },
      ] as BalanceSnapshot[];

      vi.resetModules();
      vi.mock("@/content/assettracker/accounts", () => accountsMock);
      vi.mock("@/content/assettracker/snapshots", () => snapshotsMock);

      return import("@/lib/domain/assettracker/assetTrackerRepository").then(
        ({ loadAssetTrackerRepository: freshLoad }) => {
          expect(() => freshLoad()).toThrow(/ghost-account/);
        },
      );
    });

    it("throws on invalid account data", () => {
      accountsMock.accounts = [
        {
          id: "",
          name: "Bad Account",
          provider: "Provider",
          currency: "GBP",
          assetType: "cash",
          expectedAnnualReturn: 0.03,
          createdAt: "2024-01-01",
        },
      ] as unknown as AccountContent[];
      snapshotsMock.snapshots = [];

      vi.resetModules();
      vi.mock("@/content/assettracker/accounts", () => accountsMock);
      vi.mock("@/content/assettracker/snapshots", () => snapshotsMock);

      return import("@/lib/domain/assettracker/assetTrackerRepository").then(
        ({ loadAssetTrackerRepository: freshLoad }) => {
          expect(() => freshLoad()).toThrow();
        },
      );
    });

    it("throws on invalid snapshot date", () => {
      accountsMock.accounts = [
        {
          id: "valid-1",
          name: "Valid Account",
          provider: "Provider",
          currency: "GBP",
          assetType: "cash",
          expectedAnnualReturn: 0.03,
          createdAt: "2024-01-01",
        },
      ] as AccountContent[];
      snapshotsMock.snapshots = [
        { accountId: "valid-1", date: "not-a-date", balance: 1000 },
      ] as unknown as BalanceSnapshot[];

      vi.resetModules();
      vi.mock("@/content/assettracker/accounts", () => accountsMock);
      vi.mock("@/content/assettracker/snapshots", () => snapshotsMock);

      return import("@/lib/domain/assettracker/assetTrackerRepository").then(
        ({ loadAssetTrackerRepository: freshLoad }) => {
          expect(() => freshLoad()).toThrow();
        },
      );
    });
  });
});
