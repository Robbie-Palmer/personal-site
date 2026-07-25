import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertLegacyPantryEmpty,
  discardLegacyPantry,
  getPantry,
  getPantryWithLegacyMigration,
  importLegacyPantry,
  removePantryItem,
  replacePantry,
  restorePantry,
  setPantryItem,
} from "@/lib/api/pantry";
import {
  __resetKitchenStockForTests,
  getKitchenStockSnapshot,
  setStockLocation,
} from "@/lib/kitchen/kitchenStockStore";

describe("pantry API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    __resetKitchenStockForTests();
  });

  afterEach(() => {
    __resetKitchenStockForTests();
  });

  it("loads a household-scoped pantry", async () => {
    const pantry = {
      scope: {
        type: "household" as const,
        household: { id: "household-1", name: "Park Road" },
      },
      stock: { onion: "fresh" as const },
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(pantry));

    await expect(getPantry()).resolves.toEqual(pantry);
    expect(fetchMock).toHaveBeenCalledWith("/api/pantry", {
      credentials: "same-origin",
      signal: undefined,
    });
  });

  it("requires confirmation before importing unowned legacy browser stock", async () => {
    setStockLocation("onion", "fresh");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json({ scope: { type: "personal" }, stock: {} }),
      );

    await expect(getPantryWithLegacyMigration("user-1")).resolves.toEqual({
      scope: { type: "personal" },
      stock: {},
      pendingLegacyStock: { onion: "fresh" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getKitchenStockSnapshot()).toEqual({ onion: "fresh" });
  });

  it("imports legacy stock after the user explicitly claims it", async () => {
    setStockLocation("onion", "fresh");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({ scope: { type: "personal" }, stock: {} }),
      )
      .mockResolvedValueOnce(
        Response.json({
          scope: { type: "personal" },
          stock: { onion: "fresh" },
        }),
      );

    await expect(importLegacyPantry("user-1")).resolves.toEqual({
      scope: { type: "personal" },
      stock: { onion: "fresh" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/pantry",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ stock: { onion: "fresh" } }),
      }),
    );
    expect(getKitchenStockSnapshot()).toEqual({});
  });

  it("updates and removes individual shared-stock entries", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        Response.json({ scope: { type: "personal" }, stock: {} }),
      );

    await setPantryItem("red-onion", "fridge");
    await removePantryItem("red-onion");
    await restorePantry({ red: "fresh" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/pantry/items/red-onion",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ location: "fridge" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/pantry/items/red-onion",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/pantry/restore",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ stock: { red: "fresh" } }),
      }),
    );
  });

  it("surfaces pantry API errors with their status and message", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({ error: "Pantry is unavailable" }, { status: 503 }),
      )
      .mockResolvedValueOnce(new Response("not json", { status: 502 }));

    await expect(getPantry()).rejects.toMatchObject({
      name: "ApiError",
      message: "Pantry is unavailable",
      status: 503,
    });
    await expect(replacePantry({})).rejects.toMatchObject({
      name: "ApiError",
      message: "Pantry request failed.",
      status: 502,
    });
  });

  it("discards stale legacy stock when persisted stock is authoritative", async () => {
    setStockLocation("milk", "fridge");
    const pantry = {
      scope: { type: "personal" as const },
      stock: { onion: "fresh" as const },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(pantry));

    await expect(getPantryWithLegacyMigration("user-1")).resolves.toEqual(
      pantry,
    );
    expect(getKitchenStockSnapshot()).toEqual({});
  });

  it("does not migrate legacy stock owned by another account", async () => {
    setStockLocation("onion", "fresh");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({ scope: { type: "personal" }, stock: {} }),
      )
      .mockResolvedValueOnce(
        Response.json({ error: "temporarily unavailable" }, { status: 503 }),
      )
      .mockResolvedValueOnce(
        Response.json({ scope: { type: "personal" }, stock: {} }),
      );

    await expect(importLegacyPantry("user-1")).rejects.toThrow(
      "temporarily unavailable",
    );
    await expect(getPantryWithLegacyMigration("user-2")).resolves.toEqual({
      scope: { type: "personal" },
      stock: {},
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getKitchenStockSnapshot()).toEqual({});
  });

  it("discards a pending legacy pantry without changing persisted stock", () => {
    setStockLocation("onion", "fresh");
    expect(
      discardLegacyPantry({
        scope: { type: "personal" },
        stock: {},
        pendingLegacyStock: { onion: "fresh" },
      }),
    ).toEqual({ scope: { type: "personal" }, stock: {} });
    expect(getKitchenStockSnapshot()).toEqual({});
  });

  it("blocks invitation acceptance while legacy stock remains", () => {
    expect(() => assertLegacyPantryEmpty()).not.toThrow();

    setStockLocation("onion", "fresh");
    expect(() => assertLegacyPantryEmpty()).toThrow(
      "Pantry must be empty before joining a household",
    );
  });
});
