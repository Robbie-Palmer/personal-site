import { describe, expect, it } from "vitest";
import type { DietOptions, DietProfile } from "@/lib/api/diet";
import { buildEffectiveDiet, matchRecipeToDiet } from "@/lib/domain/diet";

const options: DietOptions = {
  presets: [
    {
      key: "vegetarian",
      label: "Vegetarian",
      sub: "No meat or fish",
      excludedGroupKeys: ["meat"],
      excludedIngredientSlugs: [],
    },
  ],
  groups: [
    {
      key: "meat",
      label: "Meat",
      sub: "Meat ingredients",
      ingredientSlugs: ["chicken-breast", "beef-mince"],
    },
  ],
  ingredients: [
    { slug: "chicken-breast", name: "Chicken breast" },
    { slug: "egg", name: "Egg" },
  ],
};

function profile(overrides: Partial<DietProfile> = {}): DietProfile {
  return {
    presetDietKeys: [],
    excludedIngredientSlugs: [],
    excludedGroupKeys: [],
    recipeMatchMode: "hide",
    ...overrides,
  };
}

describe("diet recipe matching", () => {
  it("expands preset groups into canonical ingredient exclusions", () => {
    const diet = buildEffectiveDiet(
      profile({ presetDietKeys: ["vegetarian"] }),
      options,
    );

    expect(diet.excludedIngredientSlugs).toEqual(
      new Set(["chicken-breast", "beef-mince"]),
    );
    expect(
      matchRecipeToDiet({ ingredients: [{ slug: "chicken-breast" }] }, diet),
    ).toEqual({
      matches: false,
      excludedIngredients: [{ slug: "chicken-breast", name: "Chicken breast" }],
    });
  });

  it("combines custom groups and ingredients without duplicate labels", () => {
    const diet = buildEffectiveDiet(
      profile({
        excludedGroupKeys: ["meat"],
        excludedIngredientSlugs: ["egg"],
        recipeMatchMode: "warn",
      }),
      options,
    );

    expect(diet.mode).toBe("warn");
    expect(diet.labels).toEqual(["no Meat", "no Egg"]);
    expect(
      matchRecipeToDiet(
        {
          ingredients: [
            { slug: "egg", name: "Eggs" },
            { slug: "tomato", name: "Tomato" },
          ],
        },
        diet,
      ).excludedIngredients,
    ).toEqual([{ slug: "egg", name: "Eggs" }]);
  });
});
