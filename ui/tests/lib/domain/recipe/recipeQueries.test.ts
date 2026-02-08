import { describe, expect, it } from "vitest";
import type {
  Ingredient,
  IngredientSlug,
} from "@/lib/domain/recipe/ingredient";
import type { Recipe, RecipeSlug } from "@/lib/domain/recipe/recipe";
import { buildRecipeContentGraph } from "@/lib/domain/recipe/recipeGraph";
import {
  getAllCuisines,
  getAllRecipeCards,
  getAllUsedIngredientSlugs,
  getRecipeCard,
  getRecipeDetail,
  getRecipesByCuisine,
  getRecipesByIngredient,
} from "@/lib/domain/recipe/recipeQueries";
import type { RecipeRepository } from "@/lib/domain/recipe/recipeRepository";

function makeIngredient(
  name: string,
  slug?: string,
): [IngredientSlug, Ingredient] {
  const s = (slug ?? name) as IngredientSlug;
  return [s, { name, slug: s }];
}

function makeRecipe(overrides: Partial<Recipe> & { slug: string }): Recipe {
  return {
    title: overrides.slug,
    description: "Test recipe",
    date: "2024-01-01",
    tags: [],
    servings: 4,
    ingredientGroups: [
      {
        items: [{ ingredient: "chicken-breast" }],
      },
    ],
    instructions: ["Step 1"],
    ...overrides,
  };
}

function buildTestRepository(
  recipes: Recipe[],
  ingredientEntries: [IngredientSlug, Ingredient][],
): RecipeRepository {
  const recipeMap = new Map<RecipeSlug, Recipe>();
  const ingredientMap = new Map<IngredientSlug, Ingredient>(ingredientEntries);

  const recipeIngredients = new Map<RecipeSlug, IngredientSlug[]>();
  const recipeCuisines = new Map<RecipeSlug, string>();

  for (const recipe of recipes) {
    recipeMap.set(recipe.slug, recipe);
    const slugs = new Set<IngredientSlug>();
    for (const group of recipe.ingredientGroups) {
      for (const item of group.items) {
        slugs.add(item.ingredient);
      }
    }
    recipeIngredients.set(recipe.slug, Array.from(slugs));
    if (recipe.cuisine) {
      recipeCuisines.set(recipe.slug, recipe.cuisine);
    }
  }

  const graph = buildRecipeContentGraph({
    ingredientSlugs: ingredientMap.keys(),
    recipeIngredients,
    recipeCuisines,
  });

  return { recipes: recipeMap, ingredients: ingredientMap, graph };
}

const ingredients: [IngredientSlug, Ingredient][] = [
  makeIngredient("chicken breast", "chicken-breast"),
  makeIngredient("rice"),
  makeIngredient("onion"),
  makeIngredient("arborio rice", "arborio-rice"),
  makeIngredient("chorizo"),
];

const curryRecipe = makeRecipe({
  slug: "curry",
  title: "Chicken Curry",
  cuisine: "Asian",
  ingredientGroups: [
    {
      items: [
        { ingredient: "chicken-breast", amount: 3, unit: "piece" },
        { ingredient: "rice", amount: 300, unit: "g" },
        { ingredient: "onion", amount: 2, unit: "piece" },
      ],
    },
  ],
});

const risottoRecipe = makeRecipe({
  slug: "risotto",
  title: "Chorizo Risotto",
  cuisine: "Italian",
  ingredientGroups: [
    {
      items: [
        { ingredient: "chicken-breast", amount: 2, unit: "piece" },
        { ingredient: "arborio-rice", amount: 350, unit: "g" },
        { ingredient: "chorizo", amount: 200, unit: "g" },
      ],
    },
  ],
});

const repo = buildTestRepository([curryRecipe, risottoRecipe], ingredients);

describe("recipe queries", () => {
  describe("getRecipeCard", () => {
    it("returns a card view for an existing recipe", () => {
      const card = getRecipeCard(repo, "curry");
      expect(card).not.toBeNull();
      expect(card?.title).toBe("Chicken Curry");
      expect(card?.cuisine).toBe("Asian");
      expect(card?.servings).toBe(4);
    });

    it("returns null for a non-existent recipe", () => {
      expect(getRecipeCard(repo, "nonexistent")).toBeNull();
    });
  });

  describe("getRecipeDetail", () => {
    it("returns a detail view with resolved ingredient names", () => {
      const detail = getRecipeDetail(repo, "curry");
      expect(detail).not.toBeNull();
      expect(detail?.ingredientGroups).toHaveLength(1);

      const items = detail?.ingredientGroups[0]?.items;
      expect(items).toHaveLength(3);
      expect(items?.[0]?.name).toBe("chicken breast");
      expect(items?.[0]?.amount).toBe(3);
      expect(items?.[0]?.unit).toBe("piece");
    });

    it("includes instructions", () => {
      const detail = getRecipeDetail(repo, "curry");
      expect(detail?.instructions).toBeDefined();
      expect(detail?.instructions.length).toBeGreaterThan(0);
    });

    it("returns null for a non-existent recipe", () => {
      expect(getRecipeDetail(repo, "nonexistent")).toBeNull();
    });
  });

  describe("getAllRecipeCards", () => {
    it("returns all recipes as card views", () => {
      const cards = getAllRecipeCards(repo);
      expect(cards).toHaveLength(2);
      const slugs = cards.map((c) => c.slug);
      expect(slugs).toContain("curry");
      expect(slugs).toContain("risotto");
    });
  });

  describe("getRecipesByCuisine", () => {
    it("returns recipes matching a cuisine", () => {
      const asian = getRecipesByCuisine(repo, "Asian");
      expect(asian).toHaveLength(1);
      expect(asian[0]?.slug).toBe("curry");
    });

    it("returns empty array for non-existent cuisine", () => {
      expect(getRecipesByCuisine(repo, "mexican")).toEqual([]);
    });
  });

  describe("getRecipesByIngredient", () => {
    it("returns all recipes using a shared ingredient", () => {
      const recipes = getRecipesByIngredient(repo, "chicken-breast");
      expect(recipes).toHaveLength(2);
      const slugs = recipes.map((r) => r.slug);
      expect(slugs).toContain("curry");
      expect(slugs).toContain("risotto");
    });

    it("returns only recipes using a specific ingredient", () => {
      const recipes = getRecipesByIngredient(repo, "chorizo");
      expect(recipes).toHaveLength(1);
      expect(recipes[0]?.slug).toBe("risotto");
    });

    it("returns empty array for unused ingredient", () => {
      expect(getRecipesByIngredient(repo, "nonexistent")).toEqual([]);
    });
  });

  describe("getAllCuisines", () => {
    it("returns all unique cuisines", () => {
      const cuisines = getAllCuisines(repo);
      expect(cuisines).toContain("Asian");
      expect(cuisines).toContain("Italian");
      expect(cuisines).toHaveLength(2);
    });
  });

  describe("getAllUsedIngredientSlugs", () => {
    it("returns only ingredients that are actually used", () => {
      const used = getAllUsedIngredientSlugs(repo);
      expect(used).toContain("chicken-breast");
      expect(used).toContain("rice");
      expect(used).toContain("chorizo");
    });

    it("does not include unused ingredients", () => {
      // Add an ingredient that no recipe uses
      const extraIngredients: [IngredientSlug, Ingredient][] = [
        ...ingredients,
        makeIngredient("saffron"),
      ];
      const repoWithUnused = buildTestRepository(
        [curryRecipe, risottoRecipe],
        extraIngredients,
      );
      const used = getAllUsedIngredientSlugs(repoWithUnused);
      expect(used).not.toContain("saffron");
    });
  });
});
