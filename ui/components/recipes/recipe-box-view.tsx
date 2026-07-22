"use client";

import { Suspense, useCallback, useState } from "react";
import { AddRecipeButton } from "@/components/recipes/add-recipe-button";
import { RecipeCollection } from "@/components/recipes/recipe-collection";
import { CardGridSkeleton } from "@/components/ui/card-grid-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";

type VisibleRecipeCountState = {
  userId: string | null;
  count: number;
};

function formatRecipeCount(count: number | null) {
  if (count == null) return null;
  const label = count === 1 ? "recipe" : "recipes";
  return `${count.toLocaleString()} ${label}`;
}

export function RecipeBoxView() {
  const { data: session, isPending } = authClient.useSession();
  const sessionUserId = session?.user.id ?? null;
  const [countState, setCountState] = useState<VisibleRecipeCountState | null>(
    null,
  );
  const updateVisibleRecipeCount = useCallback(
    (count: number) => setCountState({ userId: sessionUserId, count }),
    [sessionUserId],
  );
  const visibleRecipeCount =
    !isPending && countState?.userId === sessionUserId
      ? countState.count
      : null;
  const recipeCountLabel = formatRecipeCount(visibleRecipeCount);

  return (
    <div className="container mx-auto min-h-screen max-w-7xl px-4 pt-5 pb-10 md:pt-7 md:pb-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <div>
          <p className="rt-mono text-[var(--terracotta)]">Your recipe box</p>
          <h1 className="rt-display mt-2 text-5xl sm:text-6xl lg:text-7xl">
            What's <span className="text-[var(--terracotta)]">cooking?</span>
          </h1>
          <div className="rt-body mt-3 flex flex-wrap gap-x-2 gap-y-1 text-base leading-snug text-[var(--ink-2)] sm:text-lg">
            {recipeCountLabel == null ? (
              <Skeleton
                aria-label="Loading recipe count"
                className="h-5 w-52"
              />
            ) : (
              [recipeCountLabel].map((stat) => (
                <span key={stat} className="whitespace-nowrap">
                  {stat}
                </span>
              ))
            )}
          </div>
        </div>
        <AddRecipeButton />
      </div>

      <Suspense fallback={<CardGridSkeleton variant="filters" />}>
        <RecipeCollection onDietVisibleCountChange={updateVisibleRecipeCount} />
      </Suspense>
    </div>
  );
}
