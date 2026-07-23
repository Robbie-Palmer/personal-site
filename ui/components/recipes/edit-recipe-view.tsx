"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AddRecipeView } from "@/components/recipes/add-recipe-view";
import {
  errorMessage,
  isAbortError,
  RecipeLoadError,
  RecipeLoading,
} from "@/components/recipes/recipe-load-state";
import type { SavedRecipeApiRecord } from "@/lib/domain/recipe/recipeDraft";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; recipe: SavedRecipeApiRecord };

export function EditRecipeView() {
  const slug = useSearchParams().get("slug");
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (
      !slug ||
      slug.length > 120 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    ) {
      setState({ status: "error", message: "No recipe was selected." });
      return;
    }
    const controller = new AbortController();
    void fetch(`/api/recipes/${encodeURIComponent(slug)}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("The recipe could not be loaded.");
        return (await response.json()) as SavedRecipeApiRecord;
      })
      .then((recipe) => {
        if (!recipe.owned)
          throw new Error("Only the recipe owner can edit it.");
        setState({ status: "ready", recipe });
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setState({
          status: "error",
          message: errorMessage(error, "The recipe could not be loaded."),
        });
      });
    return () => controller.abort();
  }, [slug]);

  if (state.status === "loading") {
    return <RecipeLoading />;
  }
  if (state.status === "error") {
    return (
      <RecipeLoadError title="Recipe unavailable" message={state.message} />
    );
  }
  return <AddRecipeView initialRecipe={state.recipe} />;
}
