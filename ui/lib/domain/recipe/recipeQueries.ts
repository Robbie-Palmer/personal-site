import type { IngredientSlug } from "./ingredient";
import type { RecipeSlug } from "./recipe";
import type { RecipeRepository } from "./recipeRepository";
import {
  type RecipeCardView,
  type RecipeDetailView,
  toRecipeCardView,
  toRecipeDetailView,
} from "./recipeViews";

export function getRecipeCard(
  repository: RecipeRepository,
  slug: RecipeSlug,
): RecipeCardView | null {
  const recipe = repository.recipes.get(slug);
  if (!recipe) return null;
  return toRecipeCardView(recipe, repository.ingredients);
}

export function getRecipeDetail(
  repository: RecipeRepository,
  slug: RecipeSlug,
): RecipeDetailView | null {
  const recipe = repository.recipes.get(slug);
  if (!recipe) return null;
  return toRecipeDetailView(recipe, repository);
}

export function getAllRecipeCards(
  repository: RecipeRepository,
): RecipeCardView[] {
  return Array.from(repository.recipes.values()).map((recipe) =>
    toRecipeCardView(recipe, repository.ingredients),
  );
}

type RecipeSortable = {
  date: string;
  slug: string;
};

export function compareRecipesByDateAndSlug<T extends RecipeSortable>(
  a: T,
  b: T,
): number {
  const dateComparison = b.date.localeCompare(a.date);
  if (dateComparison !== 0) {
    return dateComparison;
  }

  return a.slug.localeCompare(b.slug);
}

export function getRecipeNeighbors(
  repository: RecipeRepository,
  slug: RecipeSlug,
): {
  prevRecipe?: RecipeCardView;
  nextRecipe?: RecipeCardView;
} {
  const recipes = Array.from(repository.recipes.values()).sort(
    compareRecipesByDateAndSlug,
  );

  const currentIndex = recipes.findIndex((recipe) => recipe.slug === slug);
  if (currentIndex === -1) {
    return {};
  }

  const prevRecipe = currentIndex > 0 ? recipes[currentIndex - 1] : undefined;
  const nextRecipe =
    currentIndex < recipes.length - 1 ? recipes[currentIndex + 1] : undefined;

  return {
    prevRecipe: prevRecipe
      ? toRecipeCardView(prevRecipe, repository.ingredients)
      : undefined,
    nextRecipe: nextRecipe
      ? toRecipeCardView(nextRecipe, repository.ingredients)
      : undefined,
  };
}

export function getRecipesByCuisine(
  repository: RecipeRepository,
  cuisine: string,
): RecipeCardView[] {
  const recipeSlugs = repository.graph.reverse.cuisineUsedBy.get(cuisine);
  if (!recipeSlugs) return [];

  return Array.from(recipeSlugs)
    .map((slug) => repository.recipes.get(slug))
    .filter((recipe): recipe is NonNullable<typeof recipe> => recipe != null)
    .map((recipe) => toRecipeCardView(recipe, repository.ingredients));
}

export function getRecipesByIngredient(
  repository: RecipeRepository,
  ingredientSlug: IngredientSlug,
): RecipeCardView[] {
  const recipeSlugs =
    repository.graph.reverse.ingredientUsedBy.get(ingredientSlug);
  if (!recipeSlugs) return [];

  return Array.from(recipeSlugs)
    .map((slug) => repository.recipes.get(slug))
    .filter((recipe): recipe is NonNullable<typeof recipe> => recipe != null)
    .map((recipe) => toRecipeCardView(recipe, repository.ingredients));
}

export function getAllCuisines(repository: RecipeRepository): string[] {
  return Array.from(repository.graph.reverse.cuisineUsedBy.keys()).sort();
}

export function getAllUsedIngredientSlugs(
  repository: RecipeRepository,
): IngredientSlug[] {
  return Array.from(repository.graph.reverse.ingredientUsedBy.entries())
    .filter(([_, recipes]) => recipes.size > 0)
    .map(([slug]) => slug);
}
