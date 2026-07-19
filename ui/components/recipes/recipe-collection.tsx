"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RecipeList } from "@/components/recipes/recipe-list";
import {
  getRecipeBoxProfile,
  type RecipeBoxProfile,
} from "@/lib/api/recipe-box";
import type { RecipeCardView } from "@/lib/api/recipes";
import { fetchAllSavedRecipes } from "@/lib/api/saved-recipes";
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
  const [box, setBox] = useState<RecipeBoxProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      setSaved([]);
      setBox(null);
      setLoadError(null);
      return;
    }
    const controller = new AbortController();
    setLoadError(null);
    void Promise.allSettled([
      fetchAllSavedRecipes({ signal: controller.signal }),
      getRecipeBoxProfile(controller.signal),
    ]).then(([savedResult, boxResult]) => {
      if (savedResult.status === "fulfilled") {
        setSaved(savedResult.value);
      }
      if (boxResult.status === "fulfilled") {
        setBox(boxResult.value);
      }

      const errors = [savedResult, boxResult].flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      const nonAbortErrors = errors.filter(
        (error) =>
          !(error instanceof DOMException && error.name === "AbortError"),
      );
      if (nonAbortErrors.length > 0) {
        console.error("Failed to load some recipe box data", nonAbortErrors);
        setLoadError(
          "Some recipe box data could not be loaded. Available recipes are still shown.",
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
    const selectedStaticSlugs = box?.completed
      ? new Set(box.staticRecipeSlugs)
      : null;
    return [
      ...dynamic,
      ...recipes.filter(
        (recipe) =>
          !dynamicSlugs.has(recipe.slug) &&
          (!selectedStaticSlugs || selectedStaticSlugs.has(recipe.slug)),
      ),
    ];
  }, [box, recipes, saved]);

  return (
    <>
      {loadError ? (
        <output className="rt-body mb-5 block rounded-lg border border-[var(--terracotta)]/30 bg-[var(--terracotta)]/5 px-4 py-3 text-sm text-[var(--ink-2)]">
          {loadError}
        </output>
      ) : null}
      {session && box && !box.completed ? (
        <div className="rt-body mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--terracotta)]/30 bg-[var(--butter-soft)] px-4 py-3 text-sm text-[var(--ink-2)]">
          <span>
            Make this box yours with a diet and a few starter recipes.
          </span>
          <Link
            href="/recipes/onboarding"
            className="font-bold text-[var(--terracotta-deep)] hover:underline"
          >
            Set up my box →
          </Link>
        </div>
      ) : null}
      <RecipeList
        recipes={combined}
        onDietVisibleCountChange={onDietVisibleCountChange}
      />
    </>
  );
}
