"use client";

import { useEffect, useState } from "react";
import { LoggedOutLanding } from "@/components/recipes/logged-out-landing";
import { RecipeBoxView } from "@/components/recipes/recipe-box-view";
import { RecipeHomeSkeleton } from "@/components/recipes/recipe-home-skeleton";
import type { RecipeCardView } from "@/lib/api/recipes";
import { recipeRecordsToCards } from "@/lib/api/recipes";
import { fetchAllSavedRecipes } from "@/lib/api/saved-recipes";
import { authClient } from "@/lib/auth-client";

export function RecipeHome() {
  const { data: session, isPending } = authClient.useSession();
  const [publicRecipes, setPublicRecipes] = useState<RecipeCardView[] | null>(
    null,
  );

  useEffect(() => {
    if (isPending || session) return;
    const controller = new AbortController();
    void fetchAllSavedRecipes({ signal: controller.signal })
      .then((records) => setPublicRecipes(recipeRecordsToCards(records)))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Public recipes could not be loaded", error);
          setPublicRecipes([]);
        }
      });
    return () => controller.abort();
  }, [isPending, session]);

  useEffect(() => {
    if (isPending) return;
    document.title = session
      ? "Your recipe box | Robbie's Recipes"
      : "Recipes for real life | Robbie's Recipes";
  }, [isPending, session]);

  if (isPending || (!session && publicRecipes === null)) {
    return <RecipeHomeSkeleton />;
  }
  if (session) return <RecipeBoxView />;
  return <LoggedOutLanding recipes={publicRecipes ?? []} />;
}
