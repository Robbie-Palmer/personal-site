import { describe, expect, it } from "vitest";
import {
  dietCatalogIngredients,
  dietGroupMembers,
  dietPresetIngredientExclusions,
} from "../scripts/diet-catalog";

function members(groupKey: string) {
  return new Set(
    dietGroupMembers
      .filter((member) => member.groupKey === groupKey)
      .map((member) => member.ingredientSlug),
  );
}

describe("diet catalog seed", () => {
  it("seeds each canonical static ingredient exactly once", () => {
    const slugs = dietCatalogIngredients.map((ingredient) => ingredient.slug);
    expect(slugs.length).toBeGreaterThan(100);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("expands vegan groups to canonical animal-product ingredients", () => {
    expect(members("poultry")).toContain("chicken-breast");
    expect(members("dairy")).toContain("cheddar-cheese");
    expect(members("egg")).toContain("eggs");
    expect(members("dairy")).not.toContain("coconut-milk");
    expect(dietPresetIngredientExclusions).toContainEqual({
      presetKey: "vegan",
      ingredientSlug: "honey",
    });
  });

  it("seeds the custom trigger groups used by diet settings", () => {
    expect(members("onion")).toContain("shallots");
    expect(members("garlic")).toContain("garlic-powder");
    expect(members("peanut")).toContain("crunchy-peanut-butter");
  });
});
