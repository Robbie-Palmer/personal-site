import { mutationOptions, type QueryClient } from "@tanstack/react-query";
import { type DietProfile, saveDietProfile } from "@/lib/api/diet";
import { saveRecipeBoxProfile } from "@/lib/api/recipe-box";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";

export const saveDietProfileMutation = (
  queryClient: QueryClient,
  userId: string,
) =>
  mutationOptions({
    mutationKey: [...recipeQueryKeys.diet(userId), "save"],
    mutationFn: (profile: DietProfile) => saveDietProfile(profile),
    onSuccess: (profile) => {
      queryClient.setQueryData(recipeQueryKeys.dietProfile(userId), profile);
    },
  });

export const saveRecipeBoxMutation = (
  queryClient: QueryClient,
  userId: string,
) =>
  mutationOptions({
    mutationKey: [...recipeQueryKeys.recipeBox(userId), "save"],
    mutationFn: (recipeSlugs: string[]) => saveRecipeBoxProfile(recipeSlugs),
    onSuccess: async (box) => {
      queryClient.setQueryData(recipeQueryKeys.recipeBox(userId), box);
      await queryClient.invalidateQueries({
        queryKey: recipeQueryKeys.recipeBoxRecipes(userId),
      });
    },
  });
