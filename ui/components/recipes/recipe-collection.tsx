"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDiet } from "@/components/recipes/diet-provider";
import { RecipeList } from "@/components/recipes/recipe-list";
import { CardGridSkeleton } from "@/components/ui/card-grid-skeleton";
import type { RecipeBoxProfile } from "@/lib/api/recipe-box";
import { fetchRecipeBoxRecipes } from "@/lib/api/saved-recipes";
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
  onDietVisibleCountChange,
}: Readonly<{
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
    void fetchRecipeBoxRecipes(controller.signal)
      .then(({ recipes, box }) => {
        if (controller.signal.aborted) return;
        setState({
          userId,
          status: "ready",
          saved: recipes,
          box,
          loadError: null,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        console.error("Failed to load recipe box data", error);
        setState({
          userId,
          status: "ready",
          saved: [],
          box: null,
          loadError: "Your recipe box could not be loaded.",
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

  const combined = useMemo(
    () =>
      saved.flatMap((record) => {
        const card = savedRecipeCard(record);
        return card ? [card] : [];
      }),
    [saved],
  );

  if (isPending || personalizationLoading) {
    return (
      <div>
        <CardGridSkeleton variant="filters" />
        <output aria-label="Loading personalized recipes" className="sr-only">
          Loading personalized recipes…
        </output>
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
