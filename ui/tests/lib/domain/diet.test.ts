import { describe, expect, it } from "vitest";
import type { DietOptions, DietProfile } from "@/lib/api/diet";
import {
  applyDietRecipeVisibility,
  buildEffectiveDiet,
  filterRecipesForDiet,
  matchRecipeToDiet,
} from "@/lib/domain/diet";

const options: DietOptions = {
  presets: [
    {
      key: "vegetarian",
      label: "Vegetarian",
      sub: "No meat or fish",
      excludedGroupKeys: ["meat"],
      excludedIngredientSlugs: [],
    },
    {
      key: "vegan",
      label: "Vegan",
      sub: "No animal products",
      excludedGroupKeys: ["meat", "dairy", "egg"],
      excludedIngredientSlugs: ["honey"],
    },
  ],
  groups: [
    {
      key: "meat",
      label: "Meat",
      sub: "Meat ingredients",
      ingredientSlugs: ["chicken-breast", "beef-mince"],
    },
    {
      key: "dairy",
      label: "Dairy",
      sub: "Dairy ingredients",
      ingredientSlugs: ["cheddar-cheese"],
    },
    {
      key: "egg",
      label: "Egg",
      sub: "Egg ingredients",
      ingredientSlugs: ["eggs"],
    },
  ],
  ingredients: [
    { slug: "chicken-breast", name: "Chicken breast" },
    { slug: "egg", name: "Egg" },
    { slug: "cheddar-cheese", name: "Cheddar cheese" },
    { slug: "eggs", name: "Eggs" },
    { slug: "honey", name: "Honey" },
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

  it("filters representative recipes for a vegan profile", () => {
    const diet = buildEffectiveDiet(
      profile({ presetDietKeys: ["vegan"] }),
      options,
    );

    expect(diet.active).toBe(true);
    expect(
      matchRecipeToDiet(
        {
          ingredients: [{ slug: "chicken-breast" }, { slug: "cheddar-cheese" }],
        },
        diet,
      ).matches,
    ).toBe(false);
    expect(
      matchRecipeToDiet(
        { ingredients: [{ slug: "chickpeas" }, { slug: "tomato" }] },
        diet,
      ).matches,
    ).toBe(true);
  });

  it("keeps a small starter list diet-compatible instead of filling it with excluded recipes", () => {
    const diet = buildEffectiveDiet(
      profile({ presetDietKeys: ["vegan"] }),
      options,
    );
    const recipes = [
      { slug: "chickpea-stew", ingredients: [{ slug: "chickpeas" }] },
      { slug: "chicken-pie", ingredients: [{ slug: "chicken-breast" }] },
      { slug: "cheese-toast", ingredients: [{ slug: "cheddar-cheese" }] },
    ];

    expect(filterRecipesForDiet(recipes, diet, (recipe) => recipe)).toEqual([
      recipes[0],
    ]);
  });

  it("does not repeat custom exclusions already covered by a preset", () => {
    const diet = buildEffectiveDiet(
      profile({
        presetDietKeys: ["vegan"],
        excludedGroupKeys: ["meat", "dairy"],
        excludedIngredientSlugs: ["chicken-breast", "honey", "egg"],
      }),
      options,
    );

    expect(diet.labels).toEqual(["Vegan", "no Egg"]);
  });
});

describe("diet recipe visibility", () => {
  const recipes = [{ slug: "vegan" }, { slug: "bacon" }, { slug: "milk" }];
  const matches = new Map([
    ["vegan", { matches: true, excludedIngredients: [] }],
    ["bacon", { matches: false, excludedIngredients: [] }],
    ["milk", { matches: false, excludedIngredients: [] }],
  ]);
  const hideDiet = { active: true, mode: "hide" as const };

  it("counts only recipes that are actually hidden", () => {
    expect(
      applyDietRecipeVisibility(recipes, matches, hideDiet, {
        showHidden: false,
        alwaysVisibleSlugs: new Set(["bacon"]),
      }),
    ).toEqual({
      visibleRecipes: [recipes[0], recipes[1]],
      hiddenCount: 1,
    });
  });

  it("preserves the baseline hidden count while temporarily showing recipes", () => {
    expect(
      applyDietRecipeVisibility(recipes, matches, hideDiet, {
        showHidden: true,
      }),
    ).toEqual({ visibleRecipes: recipes, hiddenCount: 2 });
  });
});
