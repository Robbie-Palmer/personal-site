import { mutationOptions, type QueryClient } from "@tanstack/react-query";
import { type DietProfile, saveDietProfile } from "@/lib/api/diet";
import type { RecipeBootstrap } from "@/lib/api/recipe-bootstrap";
import { saveRecipeBoxProfile } from "@/lib/api/recipe-box";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";

export const saveDietProfileMutation = (
  queryClient: QueryClient,
  userId: string,
) =>
  mutationOptions({
    mutationKey: [...recipeQueryKeys.bootstrap(userId), "save-diet"],
    mutationFn: (profile: DietProfile) => saveDietProfile(profile),
    onSuccess: async (profile) => {
      const hadBootstrap = queryClient.getQueryData(
        recipeQueryKeys.bootstrap(userId),
      );
      queryClient.setQueryData<RecipeBootstrap>(
        recipeQueryKeys.bootstrap(userId),
        (current) =>
          current
            ? { ...current, diet: { ...current.diet, profile } }
            : current,
      );
      if (!hadBootstrap) {
        await queryClient.invalidateQueries({
          queryKey: recipeQueryKeys.bootstrap(userId),
        });
      }
    },
  });

export const saveRecipeBoxMutation = (
  queryClient: QueryClient,
  userId: string,
) =>
  mutationOptions({
    mutationKey: [...recipeQueryKeys.bootstrap(userId), "save-recipe-box"],
    mutationFn: (recipeSlugs: string[]) => saveRecipeBoxProfile(recipeSlugs),
    onSuccess: async (box) => {
      queryClient.setQueryData<RecipeBootstrap>(
        recipeQueryKeys.bootstrap(userId),
        (current) =>
          current
            ? {
                ...current,
                recipeBox: { ...current.recipeBox, box },
              }
            : current,
      );
      await queryClient.invalidateQueries({
        queryKey: recipeQueryKeys.bootstrap(userId),
      });
    },
  });
