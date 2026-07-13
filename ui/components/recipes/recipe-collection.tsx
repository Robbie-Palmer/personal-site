"use client";

import { useEffect, useMemo, useState } from "react";
import { RecipeList } from "@/components/recipes/recipe-list";
import type { RecipeCardView } from "@/lib/api/recipes";
import { authClient } from "@/lib/auth-client";
import {
  type SavedRecipeApiRecord,
  savedRecipeCard,
} from "@/lib/domain/recipe/recipeDraft";

export function RecipeCollection({
  recipes,
  onDietVisibleCountChange,
}: Readonly<{
  recipes: RecipeCardView[];
  onDietVisibleCountChange?: (count: number) => void;
}>) {
  const { isPending } = authClient.useSession();
  const [saved, setSaved] = useState<SavedRecipeApiRecord[]>([]);

  useEffect(() => {
    if (isPending) return;
    const controller = new AbortController();
    void fetch("/api/recipes", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Saved recipes unavailable");
        return (await response.json()) as SavedRecipeApiRecord[];
      })
      .then(setSaved)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Failed to load saved recipes", error);
        }
      });
    return () => controller.abort();
  }, [isPending]);

  const combined = useMemo(() => {
    const dynamic = saved.flatMap((record) => {
      const card = savedRecipeCard(record);
      return card ? [card] : [];
    });
    const dynamicSlugs = new Set(dynamic.map((recipe) => recipe.slug));
    return [
      ...dynamic,
      ...recipes.filter((recipe) => !dynamicSlugs.has(recipe.slug)),
    ];
  }, [recipes, saved]);

  return (
    <RecipeList
      recipes={combined}
      onDietVisibleCountChange={onDietVisibleCountChange}
    />
  );
}
