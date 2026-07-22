import { describe, expect, it } from "vitest";
import {
  buildKitchenCatalog,
  recipeRecordsToCards,
  recipeRecordsToDetails,
} from "@/lib/api/recipes";
import type { SavedRecipeApiRecord } from "@/lib/domain/recipe/recipeDraft";

function recipeRecord(
  slug: string,
  title: string,
  date: string,
): SavedRecipeApiRecord {
  return {
    slug,
    title,
    description: `${title} description`,
    body: JSON.stringify({
      version: 1,
      source: "Cook the ingredients.",
      recipe: {
        title,
        description: `${title} description`,
        date,
        cuisine: ["Irish"],
        servings: 2,
        prepTime: 5,
        cookTime: 10,
        tags: ["dinner"],
        cookBody: "Cook the ingredients.",
        ingredientGroups: [
          {
            items: [
              { ingredient: "garlic" },
              { ingredient: "red-lentils" },
              { ingredient: "garlic" },
            ],
          },
        ],
        instructions: ["Cook the ingredients."],
        cookware: ["pot"],
      },
    }),
    visibility: "public",
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
  };
}

describe("saved recipe API adapters", () => {
  it("converts valid records to sorted cards and details", () => {
    const older = recipeRecord("older", "Older", "2026-01-01");
    const newer = recipeRecord("newer", "Newer", "2026-07-22");
    const invalid = { ...newer, slug: "invalid", body: null };

    expect(
      recipeRecordsToCards([older, invalid, newer]).map(({ slug }) => slug),
    ).toEqual(["newer", "older"]);
    expect(
      recipeRecordsToDetails([invalid, newer]).map(({ slug }) => slug),
    ).toEqual(["newer"]);
  });

  it("builds a deduplicated, categorized kitchen catalog", () => {
    const catalog = buildKitchenCatalog([
      recipeRecord("lentil-soup", "Lentil Soup", "2026-07-22"),
    ]);

    expect(catalog.ingredients).toEqual([
      { slug: "garlic", name: "Garlic", category: "vegetable" },
      { slug: "red-lentils", name: "Red Lentils", category: "legume" },
    ]);
    expect(catalog.recipes).toEqual([
      expect.objectContaining({
        slug: "lentil-soup",
        title: "Lentil Soup",
        totalTime: 15,
        ingredients: [
          { slug: "garlic", name: "Garlic" },
          { slug: "red-lentils", name: "Red Lentils" },
        ],
      }),
    ]);
  });
});
