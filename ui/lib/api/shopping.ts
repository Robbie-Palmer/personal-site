import {
  compareRecipesByDateAndSlug,
  getAllRecipeCards,
  getRecipeDetail,
  loadRecipeRepository,
  type RecipeIngredientView,
} from "@/lib/domain/recipe";

/**
 * A compact, build-time payload for the shopping feature: everything the
 * client-side list needs to scale and aggregate ingredients for a recipe,
 * without shipping the full instruction/cook-mode detail view.
 */
export type ShoppingRecipe = {
  slug: string;
  title: string;
  /** The recipe's own servings — the denominator for per-recipe scaling. */
  servings: number;
  image?: string;
  imageAlt?: string;
  cuisine: string[];
  totalTime?: number;
  /** Every ingredient the recipe uses, flattened across its sections. */
  ingredients: RecipeIngredientView[];
};

// One repository instance for the shopping payload. Loaded lazily so importing
// this module doesn't pay the parse cost unless a shopping page needs it.
const repository = loadRecipeRepository();

export function getShoppingRecipes(): ShoppingRecipe[] {
  return getAllRecipeCards(repository)
    .sort(compareRecipesByDateAndSlug)
    .map((card): ShoppingRecipe => {
      const detail = getRecipeDetail(repository, card.slug);
      const ingredients = detail
        ? detail.ingredientGroups.flatMap((group) => group.items)
        : [];
      return {
        slug: card.slug,
        title: card.title,
        servings: Math.max(1, card.servings),
        image: card.image,
        imageAlt: card.imageAlt,
        cuisine: card.cuisine,
        totalTime: card.totalTime,
        ingredients,
      };
    });
}
