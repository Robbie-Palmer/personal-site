import { describe, expect, it } from "vitest";
import { sanitizeParsedRecipe } from "../../src/lib/recipe-output.js";

describe("sanitizeParsedRecipe", () => {
  it("drops non-finite optional scalar fields", () => {
    const input = {
      title: "T",
      description: "D",
      servings: 2,
      prepTime: Number.POSITIVE_INFINITY,
      cookTime: Number.NaN,
      ingredientGroups: [{ items: [{ ingredient: "salt", amount: 1, unit: "tsp" }] }],
      instructions: ["x"],
    };

    const out = sanitizeParsedRecipe(input) as any;
    expect(out.prepTime).toBeUndefined();
    expect(out.cookTime).toBeUndefined();
  });

  it("drops non-finite ingredient amount", () => {
    const input = {
      title: "T",
      description: "D",
      servings: 2,
      ingredientGroups: [
        {
          items: [
            { ingredient: "salt", amount: Number.POSITIVE_INFINITY, unit: "tsp" },
            { ingredient: "pepper", amount: 0.5, unit: "tsp" },
          ],
        },
      ],
      instructions: ["x"],
    };

    const out = sanitizeParsedRecipe(input) as any;
    expect(out.ingredientGroups[0].items[0].amount).toBeUndefined();
    expect(out.ingredientGroups[0].items[1].amount).toBe(0.5);
  });
});
