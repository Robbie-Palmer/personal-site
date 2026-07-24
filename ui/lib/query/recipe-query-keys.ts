const recipeRoot = ["recipes"] as const;

export const recipeQueryKeys = {
  all: recipeRoot,
  public: () => [...recipeRoot, "public"] as const,
  publicRecipes: () => [...recipeRoot, "public", "saved"] as const,
  private: () => [...recipeRoot, "private"] as const,
  user: (userId: string) => [...recipeRoot, "private", userId] as const,
  recipeBox: (userId: string) =>
    [...recipeRoot, "private", userId, "recipe-box"] as const,
  recipeBoxRecipes: (userId: string) =>
    [...recipeRoot, "private", userId, "recipe-box-recipes"] as const,
  savedRecipe: (userId: string, slug: string) =>
    [...recipeRoot, "private", userId, "saved", slug] as const,
  diet: (userId: string) => [...recipeRoot, "private", userId, "diet"] as const,
  dietProfile: (userId: string) =>
    [...recipeRoot, "private", userId, "diet", "profile"] as const,
  dietOptions: (userId: string) =>
    [...recipeRoot, "private", userId, "diet", "options"] as const,
};
