"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDiet } from "@/components/recipes/diet-provider";
import { RecipeList } from "@/components/recipes/recipe-list";
import { CardGridSkeleton } from "@/components/ui/card-grid-skeleton";
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

type RecipeCollectionState = {
  userId: string | null;
  status: "idle" | "loading" | "ready";
  saved: SavedRecipeApiRecord[];
  box: RecipeBoxProfile | null;
  loadError: string | null;
};

export function RecipeCollection({
  recipes,
  onDietVisibleCountChange,
}: Readonly<{
  recipes: RecipeCardView[];
  onDietVisibleCountChange?: (count: number) => void;
}>) {
  const { data: session, isPending } = authClient.useSession();
  const { loading: dietLoading } = useDiet();
  const sessionUserId = session?.user.id;
  const [state, setState] = useState<RecipeCollectionState>({
    userId: null,
    status: "idle",
    saved: [],
    box: null,
    loadError: null,
  });

  useEffect(() => {
    if (isPending) return;
    if (!sessionUserId) {
      setState({
        userId: null,
        status: "idle",
        saved: [],
        box: null,
        loadError: null,
      });
      return;
    }
    const controller = new AbortController();
    const userId = sessionUserId;
    setState({
      userId,
      status: "loading",
      saved: [],
      box: null,
      loadError: null,
    });
    void Promise.allSettled([
      fetchAllSavedRecipes({ signal: controller.signal }),
      getRecipeBoxProfile(controller.signal),
    ]).then(([savedResult, boxResult]) => {
      if (controller.signal.aborted) return;
      const errors = [savedResult, boxResult].flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      const nonAbortErrors = errors.filter(
        (error) =>
          !(error instanceof DOMException && error.name === "AbortError"),
      );
      if (nonAbortErrors.length > 0) {
        console.error("Failed to load some recipe box data", nonAbortErrors);
      }
      setState({
        userId,
        status: "ready",
        saved: savedResult.status === "fulfilled" ? savedResult.value : [],
        box: boxResult.status === "fulfilled" ? boxResult.value : null,
        loadError:
          nonAbortErrors.length > 0
            ? "Some recipe box data could not be loaded. Available recipes are still shown."
            : null,
      });
    });
    return () => controller.abort();
  }, [isPending, sessionUserId]);

  const stateMatchesSession = state.userId === sessionUserId;
  const personalizationLoading = Boolean(
    sessionUserId &&
      (!stateMatchesSession || state.status !== "ready" || dietLoading),
  );
  const saved = stateMatchesSession ? state.saved : [];
  const box = stateMatchesSession ? state.box : null;
  const loadError = stateMatchesSession ? state.loadError : null;

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

  if (isPending || personalizationLoading) {
    return (
      <div role="status" aria-label="Loading personalized recipes">
        <CardGridSkeleton variant="filters" />
        <span className="sr-only">Loading personalized recipes…</span>
      </div>
    );
  }

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
