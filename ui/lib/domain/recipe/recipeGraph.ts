import type { IngredientSlug } from "./ingredient";
import type { RecipeSlug } from "./recipe";

export interface RecipeContentGraph {
  edges: {
    usesIngredient: Map<RecipeSlug, Set<IngredientSlug>>;
    hasCuisine: Map<RecipeSlug, string>;
  };
  reverse: {
    ingredientUsedBy: Map<IngredientSlug, Set<RecipeSlug>>;
    cuisineUsedBy: Map<string, Set<RecipeSlug>>;
  };
}

export function buildRecipeContentGraph(input: {
  ingredientSlugs: Iterable<IngredientSlug>;
  recipeIngredients: Map<RecipeSlug, IngredientSlug[]>;
  recipeCuisines: Map<RecipeSlug, string>;
}): RecipeContentGraph {
  const graph: RecipeContentGraph = {
    edges: {
      usesIngredient: new Map(),
      hasCuisine: new Map(),
    },
    reverse: {
      ingredientUsedBy: new Map(),
      cuisineUsedBy: new Map(),
    },
  };

  for (const slug of input.ingredientSlugs) {
    graph.reverse.ingredientUsedBy.set(slug, new Set());
  }

  for (const [recipeSlug, ingredientSlugs] of input.recipeIngredients) {
    if (ingredientSlugs.length === 0) continue;
    graph.edges.usesIngredient.set(recipeSlug, new Set(ingredientSlugs));
    for (const ingredientSlug of ingredientSlugs) {
      const reverseSet = graph.reverse.ingredientUsedBy.get(ingredientSlug);
      if (!reverseSet) {
        throw new Error(
          `Unknown ingredient "${ingredientSlug}" referenced by recipe "${recipeSlug}" was not registered via ingredientSlugs`,
        );
      }
      reverseSet.add(recipeSlug);
    }
  }

  for (const [recipeSlug, cuisine] of input.recipeCuisines) {
    graph.edges.hasCuisine.set(recipeSlug, cuisine);
    if (!graph.reverse.cuisineUsedBy.has(cuisine)) {
      graph.reverse.cuisineUsedBy.set(cuisine, new Set());
    }
    graph.reverse.cuisineUsedBy.get(cuisine)?.add(recipeSlug);
  }

  return graph;
}
