import { beforeEach, describe, expect, it } from "vitest";
import {
  ASSET_TRACKER_STORAGE_KEY,
  createLocalAssetTrackerApi,
} from "@/lib/api/assettracker";
import { getSeedData } from "@/lib/domain/assettracker";

describe("createLocalAssetTrackerApi", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function createApi() {
    return createLocalAssetTrackerApi(window.localStorage);
  }

  it("loads the seed data when nothing is stored", async () => {
    const { data, persisted } = await createApi().load();

    expect(persisted).toBe(false);
    expect(data).toEqual(getSeedData());
  });

  it("persists mutations across instances", async () => {
    const seed = getSeedData();
    const accountId = seed.accounts.find((a) => !a.closedAt)?.id;
    if (!accountId) throw new Error("seed data has no open account");

    await createApi().recordBalance({
      accountId,
      date: "2025-06-01",
      balance: 42000,
    });

    const { data, persisted } = await createApi().load();
    expect(persisted).toBe(true);
    expect(data.snapshots).toContainEqual({
      accountId,
      date: "2025-06-01",
      balance: 42000,
    });
  });

  it("persists created accounts", async () => {
    const seed = getSeedData();
    await createApi().createAccount({
      name: "Premium Bonds",
      provider: "NS&I",
      currency: "GBP",
      assetType: "cash",
      expectedAnnualReturn: 0.04,
      openingBalance: 5000,
      openingDate: "2025-01-01",
    });

    const { data } = await createApi().load();
    expect(data.accounts).toHaveLength(seed.accounts.length + 1);
    expect(data.accounts.map((a) => a.id)).toContain("premium-bonds");
  });

  it("persists an atomic account-history import", async () => {
    const seed = getSeedData();
    const accountId = seed.accounts.find((account) => !account.closedAt)?.id;
    if (!accountId) throw new Error("seed data has no open account");

    await createApi().importAccountHistory({
      accountId,
      balances: [{ date: "2025-01-31", value: 15000 }],
      capitalFlows: [{ date: "2025-01-31", value: 500 }],
    });

    const { data } = await createApi().load();
    expect(data.snapshots).toContainEqual({
      accountId,
      date: "2025-01-31",
      balance: 15000,
    });
    expect(data.capitalFlows).toContainEqual({
      accountId,
      date: "2025-01-31",
      amount: 500,
    });
  });

  it("falls back to seed data when stored JSON is corrupt", async () => {
    window.localStorage.setItem(ASSET_TRACKER_STORAGE_KEY, "{not json");

    const { data, persisted } = await createApi().load();
    expect(persisted).toBe(false);
    expect(data).toEqual(getSeedData());
  });

  it("falls back to seed data when stored data fails validation", async () => {
    window.localStorage.setItem(
      ASSET_TRACKER_STORAGE_KEY,
      JSON.stringify({ accounts: [{ id: "broken" }], snapshots: [] }),
    );

    const { persisted } = await createApi().load();
    expect(persisted).toBe(false);
  });

  it("loads older saved data with no capital-flow collection", async () => {
    const { capitalFlows: _capitalFlows, ...legacy } = getSeedData();
    window.localStorage.setItem(
      ASSET_TRACKER_STORAGE_KEY,
      JSON.stringify(legacy),
    );

    const { data, persisted } = await createApi().load();

    expect(persisted).toBe(true);
    expect(data.capitalFlows).toEqual([]);
  });

  it("rejects importing data that fails validation", async () => {
    await expect(
      createApi().importData({ accounts: "nope" }),
    ).rejects.toThrow();
  });

  it("rejects importing data with orphan snapshots", async () => {
    await expect(
      createApi().importData({
        accounts: [],
        snapshots: [{ accountId: "ghost", date: "2024-01-01", balance: 1 }],
      }),
    ).rejects.toThrow(/unknown account/);
  });

  it("imports and persists a valid export", async () => {
    const exported = getSeedData();
    const imported = await createApi().importData(exported);

    expect(imported).toEqual(exported);
    const { persisted } = await createApi().load();
    expect(persisted).toBe(true);
  });

  it("reset clears stored data and returns the seed", async () => {
    const api = createApi();
    const seed = getSeedData();
    const accountId = seed.accounts.find((a) => !a.closedAt)?.id;
    if (!accountId) throw new Error("seed data has no open account");
    await api.recordBalance({ accountId, date: "2025-06-01", balance: 1 });

    const data = await api.reset();

    expect(data).toEqual(seed);
    expect(window.localStorage.getItem(ASSET_TRACKER_STORAGE_KEY)).toBeNull();
    const { persisted } = await createApi().load();
    expect(persisted).toBe(false);
  });
});
