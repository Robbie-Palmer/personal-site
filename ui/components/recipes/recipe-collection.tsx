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
  const { data: session, isPending } = authClient.useSession();
  const [saved, setSaved] = useState<SavedRecipeApiRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      setSaved([]);
      setLoadError(null);
      return;
    }
    const controller = new AbortController();
    setLoadError(null);
    void fetch("/api/recipes", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Saved recipes unavailable");
        return (await response.json()) as SavedRecipeApiRecord[];
      })
      .then(setSaved)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Failed to load saved recipes", error);
          setLoadError(
            "Your saved recipes could not be loaded. Static recipes are still available.",
          );
        }
      });
    return () => controller.abort();
  }, [isPending, session]);

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
    <>
      {loadError ? (
        <p
          role="status"
          className="rt-body mb-5 rounded-lg border border-[var(--terracotta)]/30 bg-[var(--terracotta)]/5 px-4 py-3 text-sm text-[var(--ink-2)]"
        >
          {loadError}
        </p>
      ) : null}
      <RecipeList
        recipes={combined}
        onDietVisibleCountChange={onDietVisibleCountChange}
      />
    </>
  );
}
