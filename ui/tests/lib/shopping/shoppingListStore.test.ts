import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __resetShoppingListForTests,
  addExtra,
  addRecipe,
  getShoppingListSnapshot,
  removeExtra,
  setRecipeServings,
  toggleChecked,
  toggleExtra,
} from "@/lib/shopping/shoppingListStore";

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
});
