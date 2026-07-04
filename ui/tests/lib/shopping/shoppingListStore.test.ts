import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetShoppingListForTests,
  addExtra,
  addRecipe,
  clearChecked,
  clearList,
  getShoppingListSnapshot,
  removeExtra,
  removeRecipe,
  setRecipeServings,
  subscribeShoppingList,
  toggleChecked,
  toggleExtra,
  toggleRecipe,
} from "@/lib/shopping/shoppingListStore";

// Mirrors the module's private persistence key.
const STORAGE_KEY = "recipe-shopping-list:v1";

describe("shoppingListStore", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetShoppingListForTests();
  });
  afterEach(() => {
    __resetShoppingListForTests();
  });

  it("adds recipes without duplicating and applies servings overrides", () => {
    addRecipe("risotto");
    addRecipe("risotto");
    setRecipeServings("risotto", 6);
    expect(getShoppingListSnapshot().recipes).toEqual([
      { slug: "risotto", servings: 6 },
    ]);
  });

  it("ignores a case-insensitive duplicate extra", () => {
    addExtra("Milk");
    addExtra("milk");
    addExtra("  MILK  ");
    const { extras } = getShoppingListSnapshot();
    expect(extras).toHaveLength(1);
    expect(extras[0]!.text).toBe("Milk");
  });

  it("adds genuinely different extras", () => {
    addExtra("milk");
    addExtra("bread");
    expect(getShoppingListSnapshot().extras.map((e) => e.text)).toEqual([
      "milk",
      "bread",
    ]);
  });

  it("keeps ingredient ticks and extra ticks independent", () => {
    // An extra that shares an ingredient's name is a separate row with its own
    // checked state — ticking one must not tick the other.
    addExtra("garlic");
    toggleChecked("garlic"); // ticks the *ingredient* slug
    const { checked, extras } = getShoppingListSnapshot();
    expect(checked).toContain("garlic");
    expect(extras[0]!.checked).toBe(false);

    toggleExtra(extras[0]!.id); // ticks the *extra*
    expect(getShoppingListSnapshot().extras[0]!.checked).toBe(true);
    // ingredient tick unchanged
    expect(getShoppingListSnapshot().checked).toContain("garlic");
  });

  it("removes an extra by id", () => {
    addExtra("napkins");
    const id = getShoppingListSnapshot().extras[0]!.id;
    removeExtra(id);
    expect(getShoppingListSnapshot().extras).toHaveLength(0);
  });

  it("normalises fractional persisted servings to an integer on hydration", () => {
    // Simulate stale/edited localStorage carrying a non-integer servings value.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        recipes: [{ slug: "risotto", servings: 2.6 }],
        checked: [],
        extras: [],
      }),
    );
    __resetShoppingListForTests(); // force re-hydration from storage
    expect(getShoppingListSnapshot().recipes).toEqual([
      { slug: "risotto", servings: 3 },
    ]);
  });

  it("installs a single shared storage listener regardless of subscriber count", () => {
    const addSpy = vi.spyOn(globalThis, "addEventListener");
    const unsub = [
      subscribeShoppingList(() => {}),
      subscribeShoppingList(() => {}),
      subscribeShoppingList(() => {}),
    ];
    const storageListeners = addSpy.mock.calls.filter(
      ([type]) => type === "storage",
    );
    expect(storageListeners).toHaveLength(1);
    for (const u of unsub) u();
    addSpy.mockRestore();
  });

  it("toggles a recipe on and off", () => {
    toggleRecipe("paella");
    expect(getShoppingListSnapshot().recipes).toEqual([{ slug: "paella" }]);
    toggleRecipe("paella");
    expect(getShoppingListSnapshot().recipes).toEqual([]);
  });

  it("removes a recipe by slug", () => {
    addRecipe("a");
    addRecipe("b");
    removeRecipe("a");
    expect(getShoppingListSnapshot().recipes).toEqual([{ slug: "b" }]);
  });

  it("clearChecked unticks ingredients and extras but keeps them", () => {
    addExtra("foil");
    toggleChecked("garlic");
    toggleExtra(getShoppingListSnapshot().extras[0]!.id);
    clearChecked();
    const snap = getShoppingListSnapshot();
    expect(snap.checked).toEqual([]);
    expect(snap.extras[0]!.checked).toBe(false);
    expect(snap.extras).toHaveLength(1); // extra itself is retained
  });

  it("clearList wipes everything", () => {
    addRecipe("a");
    addExtra("foil");
    toggleChecked("garlic");
    clearList();
    expect(getShoppingListSnapshot()).toEqual({
      recipes: [],
      checked: [],
      extras: [],
    });
  });

  it("syncs state from a cross-tab storage event", () => {
    const seen: number[] = [];
    const unsub = subscribeShoppingList(() =>
      seen.push(getShoppingListSnapshot().recipes.length),
    );
    globalThis.dispatchEvent(
      new StorageEvent("storage", {
        key: STORAGE_KEY,
        newValue: JSON.stringify({
          recipes: [{ slug: "x" }, { slug: "y" }],
          checked: [],
          extras: [],
        }),
      }),
    );
    expect(getShoppingListSnapshot().recipes).toHaveLength(2);
    expect(seen).toContain(2); // subscribers were notified
    unsub();
  });
});
