import { queryOptions } from "@tanstack/react-query";
import { getRecipeBootstrap } from "@/lib/api/recipe-bootstrap";
import { recipeRecordsToCards } from "@/lib/api/recipes";
import { fetchAllSavedRecipes, getSavedRecipe } from "@/lib/api/saved-recipes";
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
    queryKey: recipeQueryKeys.bootstrap(userId),
    queryFn: ({ signal }) => getRecipeBootstrap(signal),
    select: (bootstrap) => bootstrap.recipeBox,
    staleTime: USER_DATA_STALE_TIME,
    refetchOnWindowFocus: true,
  });

export const dietProfileQuery = (userId: string) =>
  queryOptions({
    queryKey: recipeQueryKeys.bootstrap(userId),
    queryFn: ({ signal }) => getRecipeBootstrap(signal),
    select: (bootstrap) => bootstrap.diet.profile,
    staleTime: USER_DATA_STALE_TIME,
    refetchOnWindowFocus: true,
  });

export const dietOptionsQuery = (userId: string) =>
  queryOptions({
    queryKey: recipeQueryKeys.bootstrap(userId),
    queryFn: ({ signal }) => getRecipeBootstrap(signal),
    select: (bootstrap) => bootstrap.diet.options,
    staleTime: USER_DATA_STALE_TIME,
    refetchOnWindowFocus: true,
  });

export const recipeBootstrapQuery = (userId: string) =>
  queryOptions({
    queryKey: recipeQueryKeys.bootstrap(userId),
    queryFn: ({ signal }) => getRecipeBootstrap(signal),
    staleTime: USER_DATA_STALE_TIME,
    refetchOnWindowFocus: true,
  });

export const savedRecipeQuery = (userId: string | null, slug: string) =>
  queryOptions({
    queryKey: userId
      ? recipeQueryKeys.savedRecipe(userId, slug)
      : recipeQueryKeys.publicSavedRecipe(slug),
    queryFn: ({ signal }) => getSavedRecipe(slug, signal),
    staleTime: USER_DATA_STALE_TIME,
    refetchOnWindowFocus: true,
  });
