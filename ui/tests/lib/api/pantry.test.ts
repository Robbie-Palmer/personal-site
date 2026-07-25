import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPantry,
  getPantryWithLegacyMigration,
  removePantryItem,
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

  it("migrates legacy browser stock into an empty personal pantry", async () => {
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

    await expect(getPantryWithLegacyMigration()).resolves.toEqual({
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
  });
});
