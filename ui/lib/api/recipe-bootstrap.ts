import type { DietOptions, DietProfile } from "@/lib/api/diet";
import { apiRequest } from "@/lib/api/http";
import type { RecipeBoxProfile } from "@/lib/api/recipe-box";
import type { SavedRecipeApiRecord } from "@/lib/domain/recipe/recipeDraft";

type RecipeBootstrapResponse = {
  recipeBox: {
    ownedRecipes: SavedRecipeApiRecord[];
    readableRecipes: SavedRecipeApiRecord[];
    profile: RecipeBoxProfile;
  };
  diet: {
    profile: DietProfile;
    options: DietOptions;
  };
  unreadNotificationCount: number;
};

export type RecipeBootstrap = {
  recipeBox: {
    recipes: SavedRecipeApiRecord[];
    box: RecipeBoxProfile;
  };
  diet: RecipeBootstrapResponse["diet"];
  unreadNotificationCount: number;
};

function selectRecipeBoxRecipes(
  owned: SavedRecipeApiRecord[],
  readable: SavedRecipeApiRecord[],
  box: RecipeBoxProfile,
) {
  const ownedSlugs = new Set(owned.map((recipe) => recipe.slug));
  const selectedSlugs = new Set(box.recipeSlugs);
  const selectedOrStarterRecipes = readable.filter(
    (recipe) =>
      !ownedSlugs.has(recipe.slug) &&
      (!box.completed || selectedSlugs.has(recipe.slug)),
  );
  return [...owned, ...selectedOrStarterRecipes];
}

export async function getRecipeBootstrap(
  signal?: AbortSignal,
): Promise<RecipeBootstrap> {
  const response = await apiRequest<RecipeBootstrapResponse>(
    "/api/profile/bootstrap",
    {
      signal,
      fallbackMessage: "Recipe profile request failed.",
    },
  );
  return {
    recipeBox: {
      recipes: selectRecipeBoxRecipes(
        response.recipeBox.ownedRecipes,
        response.recipeBox.readableRecipes,
        response.recipeBox.profile,
      ),
      box: response.recipeBox.profile,
    },
    diet: response.diet,
    unreadNotificationCount: response.unreadNotificationCount,
  };
}
