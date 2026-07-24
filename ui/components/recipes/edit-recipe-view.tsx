"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { isRecipeSlug } from "recipe-domain/slugs";
import { AddRecipeView } from "@/components/recipes/add-recipe-view";
import {
  errorMessage,
  RecipeLoadError,
  RecipeLoading,
  RecipeQueryStatus,
} from "@/components/recipes/recipe-load-state";
import { authClient } from "@/lib/auth-client";
import { savedRecipeQuery } from "@/lib/query/recipe-queries";

export function EditRecipeView() {
  const slug = useSearchParams().get("slug");
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const validSlug = isRecipeSlug(slug);
  const result = useQuery({
    ...savedRecipeQuery(session?.user.id ?? "pending", slug ?? "invalid"),
    enabled: !sessionPending && Boolean(session) && validSlug,
  });

  if (!validSlug) {
    return (
      <RecipeLoadError
        title="Recipe unavailable"
        message="No recipe was selected."
      />
    );
  }
  if (sessionPending || result.isPending) {
    return <RecipeLoading />;
  }
  if (result.isError && result.data === undefined) {
    return (
      <RecipeLoadError
        title="Recipe unavailable"
        message={errorMessage(result.error, "The recipe could not be loaded.")}
      />
    );
  }
  if (!result.data.owned) {
    return (
      <RecipeLoadError
        title="Recipe unavailable"
        message="Only the recipe owner can edit it."
      />
    );
  }
  return (
    <>
      <RecipeQueryStatus
        error={result.error}
        hasData
        isFetching={result.isFetching}
        isStale={result.isStale}
        subject="this recipe"
      />
      <AddRecipeView initialRecipe={result.data} />
    </>
  );
}
