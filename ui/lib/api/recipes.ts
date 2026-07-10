import {
  compareRecipesByDateAndSlug,
  getAllRecipeCards,
  getRecipeDetail,
  getRecipeNeighbors,
  type IngredientSlug,
  type KitchenIngredientView,
  type KitchenRecipeView,
  loadRecipeRepository,
  type RecipeCardView,
  type RecipeDetailView,
  toKitchenIngredientView,
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

export function getKitchenIngredients(): KitchenIngredientView[] {
  return Array.from(repository.ingredients.values())
    .map(toKitchenIngredientView)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getKitchenRecipes(): KitchenRecipeView[] {
  return Array.from(repository.recipes.values())
    .sort(compareRecipesByDateAndSlug)
    .map((recipe) => {
      const ingredientsBySlug = new Map<
        IngredientSlug,
        KitchenRecipeView["ingredients"][number]
      >();

      for (const group of recipe.ingredientGroups) {
        for (const item of group.items) {
          const ingredient = repository.ingredients.get(item.ingredient);
          ingredientsBySlug.set(item.ingredient, {
            slug: item.ingredient,
            name: ingredient?.name ?? item.ingredient,
          });
        }
      }

      const totalTime =
        recipe.prepTime != null && recipe.cookTime != null
          ? recipe.prepTime + recipe.cookTime
          : (recipe.prepTime ?? recipe.cookTime);

      return {
        slug: recipe.slug,
        title: recipe.title,
        cuisine: recipe.cuisine,
        totalTime,
        image: recipe.image,
        imageAlt: recipe.imageAlt,
        ingredients: Array.from(ingredientsBySlug.values()).sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      };
    });
}

export function getRecipeNavigation(slug: string): {
  prevRecipe?: RecipeCardView;
  nextRecipe?: RecipeCardView;
} {
  return getRecipeNeighbors(repository, slug);
}
