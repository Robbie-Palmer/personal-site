import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __resetKitchenStockForTests,
  clearStock,
  getKitchenStockSnapshot,
  removeFromStock,
  replaceStock,
  setStockLocation,
} from "@/lib/kitchen/kitchenStockStore";

// Mirrors the module's private persistence key.
const STORAGE_KEY = "recipe-kitchen-stock-v1";

describe("kitchenStockStore", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetKitchenStockForTests();
  });
  afterEach(() => {
    __resetKitchenStockForTests();
  });

  it("sets and overwrites an ingredient's location", () => {
    setStockLocation("onion", "fresh");
    expect(getKitchenStockSnapshot()).toEqual({ onion: "fresh" });
    setStockLocation("onion", "cupboards");
    expect(getKitchenStockSnapshot()).toEqual({ onion: "cupboards" });
  });

  it("removes an ingredient from stock", () => {
    setStockLocation("onion", "fresh");
    setStockLocation("butter", "fridge");
    removeFromStock("onion");
    expect(getKitchenStockSnapshot()).toEqual({ butter: "fridge" });
  });

  it("clears everything and can be restored via replaceStock", () => {
    setStockLocation("onion", "fresh");
    setStockLocation("butter", "fridge");
    const before = { ...getKitchenStockSnapshot() };
    clearStock();
    expect(getKitchenStockSnapshot()).toEqual({});
    replaceStock(before);
    expect(getKitchenStockSnapshot()).toEqual(before);
  });

  it("persists to localStorage so other tabs/views share the stock", () => {
    setStockLocation("onion", "fresh");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).toEqual({
      onion: "fresh",
    });
  });

  it("drops entries with an invalid location on hydration", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ onion: "fresh", mystery: "garage" }),
    );
    __resetKitchenStockForTests(); // force re-hydration from storage
    expect(getKitchenStockSnapshot()).toEqual({ onion: "fresh" });
  });
});
