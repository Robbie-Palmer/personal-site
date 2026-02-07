import { describe, expect, it, vi } from "vitest";
import type { IngredientContent } from "@/lib/domain/recipe/ingredient";
import type { RecipeContent } from "@/lib/domain/recipe/recipe";

const ingredientsMock = vi.hoisted(() => ({
  ingredients: [
    { name: "chicken breast", category: "protein" },
    { name: "rice", category: "grain" },
    { name: "onion", category: "vegetable" },
  ] as IngredientContent[],
}));

const recipesMock = vi.hoisted(() => ({
  recipes: [
    {
      title: "Test Curry",
      slug: "test-curry",
      description: "A test curry",
      date: "2024-01-01",
      tags: ["asian"],
      servings: 4,
      prepTime: 10,
      cookTime: 30,
      ingredientGroups: [
        {
          items: [
            { ingredient: "chicken-breast", amount: 3, unit: "piece" },
            { ingredient: "rice", amount: 300, unit: "g" },
            { ingredient: "onion", amount: 2, unit: "piece" },
          ],
        },
      ],
      instructions: ["Cook the curry"],
    },
  ] as RecipeContent[],
}));

vi.mock("@/content/recipes/ingredients", () => ingredientsMock);
vi.mock("@/content/recipes/recipes", () => recipesMock);

// Must import after mocks
import { loadRecipeRepository } from "@/lib/domain/recipe/recipeRepository";

// Clear cached repository between tests
vi.hoisted(() => {
  const originalModule = vi.importActual(
    "@/lib/domain/recipe/recipeRepository",
  );
  return originalModule;
});

describe("RecipeRepository", () => {
  describe("loadRecipeRepository", () => {
    it("loads recipes and ingredients", () => {
      const repo = loadRecipeRepository();

      expect(repo.recipes.size).toBe(1);
      expect(repo.ingredients.size).toBe(3);
      expect(repo.recipes.has("test-curry")).toBe(true);
      expect(repo.ingredients.has("chicken-breast")).toBe(true);
    });

    it("resolves ingredient slugs from names", () => {
      const repo = loadRecipeRepository();

      expect(repo.ingredients.has("chicken-breast")).toBe(true);
      expect(repo.ingredients.has("rice")).toBe(true);
      expect(repo.ingredients.has("onion")).toBe(true);
    });

    it("builds graph with ingredient edges", () => {
      const repo = loadRecipeRepository();

      const edges = repo.graph.edges.usesIngredient.get("test-curry");
      expect(edges?.has("chicken-breast")).toBe(true);
      expect(edges?.has("rice")).toBe(true);
      expect(edges?.has("onion")).toBe(true);
    });

    it("builds graph with tag edges", () => {
      const repo = loadRecipeRepository();

      const tags = repo.graph.edges.hasTag.get("test-curry");
      expect(tags?.has("asian")).toBe(true);
    });

    it("builds reverse ingredient lookup", () => {
      const repo = loadRecipeRepository();

      const recipes = repo.graph.reverse.ingredientUsedBy.get("chicken-breast");
      expect(recipes?.has("test-curry")).toBe(true);
    });
  });

  describe("ingredient validation", () => {
    it("throws when a recipe references an undefined ingredient", () => {
      recipesMock.recipes = [
        {
          title: "Bad Recipe",
          slug: "bad-recipe",
          description: "Uses missing ingredient",
          date: "2024-01-01",
          tags: [],
          servings: 2,
          prepTime: 5,
          cookTime: 10,
          ingredientGroups: [
            {
              items: [
                {
                  ingredient: "unicorn-tears",
                  amount: 1,
                  unit: "tbsp",
                },
              ],
            },
          ],
          instructions: ["Cry"],
        },
      ];

      // Need to bust the cache by re-importing
      vi.resetModules();
      vi.mock("@/content/recipes/ingredients", () => ingredientsMock);
      vi.mock("@/content/recipes/recipes", () => recipesMock);

      // Dynamic import to get fresh module with reset cache
      return import("@/lib/domain/recipe/recipeRepository").then(
        ({ loadRecipeRepository: freshLoad }) => {
          expect(() => freshLoad()).toThrow(/unicorn-tears/);
        },
      );
    });
  });
});
