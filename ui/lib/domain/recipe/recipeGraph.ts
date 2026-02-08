import type { IngredientSlug } from "./ingredient";
import type { RecipeSlug } from "./recipe";

export interface RecipeContentGraph {
  edges: {
    usesIngredient: Map<RecipeSlug, Set<IngredientSlug>>;
    hasTag: Map<RecipeSlug, Set<string>>;
  };
  reverse: {
    ingredientUsedBy: Map<IngredientSlug, Set<RecipeSlug>>;
    tagUsedBy: Map<string, Set<RecipeSlug>>;
  };
}

export function buildRecipeContentGraph(input: {
  ingredientSlugs: Iterable<IngredientSlug>;
  recipeIngredients: Map<RecipeSlug, IngredientSlug[]>;
  recipeTags: Map<RecipeSlug, string[]>;
}): RecipeContentGraph {
  const graph: RecipeContentGraph = {
    edges: {
      usesIngredient: new Map(),
      hasTag: new Map(),
    },
    reverse: {
      ingredientUsedBy: new Map(),
      tagUsedBy: new Map(),
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

  for (const [recipeSlug, tags] of input.recipeTags) {
    if (tags.length === 0) continue;
    graph.edges.hasTag.set(recipeSlug, new Set(tags));
    for (const tag of tags) {
      if (!graph.reverse.tagUsedBy.has(tag)) {
        graph.reverse.tagUsedBy.set(tag, new Set());
      }
      graph.reverse.tagUsedBy.get(tag)?.add(recipeSlug);
    }
  }

  return graph;
}
