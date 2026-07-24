import { queryOptions } from "@tanstack/react-query";
import { getDietOptions, getDietProfile } from "@/lib/api/diet";
import { recipeRecordsToCards } from "@/lib/api/recipes";
import {
  fetchAllSavedRecipes,
  fetchRecipeBoxRecipes,
  getSavedRecipe,
} from "@/lib/api/saved-recipes";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";

const USER_DATA_STALE_TIME = 5 * 60_000;

export const publicRecipesQuery = () =>
  queryOptions({
    queryKey: recipeQueryKeys.publicRecipes(),
    queryFn: ({ signal }) =>
      fetchAllSavedRecipes({ signal }).then(recipeRecordsToCards),
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: true,
  });

export const recipeBoxRecipesQuery = (userId: string) =>
  queryOptions({
    queryKey: recipeQueryKeys.recipeBoxRecipes(userId),
    queryFn: ({ signal }) => fetchRecipeBoxRecipes(signal),
    staleTime: USER_DATA_STALE_TIME,
    refetchOnWindowFocus: true,
  });

export const dietProfileQuery = (userId: string) =>
  queryOptions({
    queryKey: recipeQueryKeys.dietProfile(userId),
    queryFn: ({ signal }) => getDietProfile(signal),
    staleTime: USER_DATA_STALE_TIME,
    refetchOnWindowFocus: true,
  });

export const dietOptionsQuery = (userId: string) =>
  queryOptions({
    queryKey: recipeQueryKeys.dietOptions(userId),
    queryFn: ({ signal }) => getDietOptions(signal),
    staleTime: 60 * 60_000,
  });

export const savedRecipeQuery = (userId: string, slug: string) =>
  queryOptions({
    queryKey: recipeQueryKeys.savedRecipe(userId, slug),
    queryFn: ({ signal }) => getSavedRecipe(slug, signal),
    staleTime: USER_DATA_STALE_TIME,
    refetchOnWindowFocus: true,
  });
