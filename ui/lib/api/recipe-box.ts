import { apiRequest } from "@/lib/api/http";

export type RecipeBoxProfile = {
  completed: boolean;
  recipeSlugs: string[];
};

async function recipeBoxRequest(
  method: "GET" | "PUT",
  recipeSlugs?: string[],
  signal?: AbortSignal,
) {
  const body = await apiRequest<
    RecipeBoxProfile & {
      staticRecipeSlugs?: string[];
    }
  >("/api/profile/recipe-box", {
    ...(method === "PUT" ? { method } : {}),
    json: recipeSlugs === undefined ? undefined : { recipeSlugs },
    ...(signal ? { signal } : {}),
    fallbackMessage: "Recipe box request failed.",
  });
  return {
    completed: body.completed,
    recipeSlugs: body.recipeSlugs ?? body.staticRecipeSlugs ?? [],
  };
}

export async function getRecipeBoxProfile(signal?: AbortSignal) {
  return recipeBoxRequest("GET", undefined, signal);
}

export async function saveRecipeBoxProfile(recipeSlugs: string[]) {
  return recipeBoxRequest("PUT", recipeSlugs);
}
