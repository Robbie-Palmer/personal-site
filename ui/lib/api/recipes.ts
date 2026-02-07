import {
  getRecipeDetail,
  loadDomainRepository,
  type RecipeCardView,
  type RecipeDetailView,
} from "@/lib/domain";

const repository = loadDomainRepository();

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

export function getAllRecipes(): RecipeDetailView[] {
  return Array.from(repository.recipes.keys())
    .map((slug) => getRecipeDetail(repository, slug))
    .filter((recipe): recipe is RecipeDetailView => recipe !== null)
    .sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
}
