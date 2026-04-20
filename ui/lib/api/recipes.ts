import {
  compareRecipesByDateAndSlug,
  getAllRecipeCards,
  getRecipeDetail,
  getRecipeNeighbors,
  loadRecipeRepository,
  type RecipeCardView,
  type RecipeDetailView,
} from "@/lib/domain/recipe";

const repository = loadRecipeRepository();

export type { RecipeCardView, RecipeDetailView };

export function getAllRecipeSlugs(): string[] {
  return Array.from(repository.recipes.keys());
}

export function getRecipeBySlug(slug: string): RecipeDetailView {
  const recipe = getRecipeDetail(repository, slug);
  if (!recipe) {
    throw new Error(`Recipe not found: ${slug}`);
  }
  return recipe;
}

export function getAllRecipes(): RecipeCardView[] {
  return getAllRecipeCards(repository).sort(compareRecipesByDateAndSlug);
}

export function getRecipeNavigation(slug: string): {
  prevRecipe?: RecipeCardView;
  nextRecipe?: RecipeCardView;
} {
  return getRecipeNeighbors(repository, slug);
}
