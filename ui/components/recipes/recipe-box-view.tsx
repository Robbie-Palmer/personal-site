"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { AddRecipeButton } from "@/components/recipes/add-recipe-button";
import { RecipeCollection } from "@/components/recipes/recipe-collection";
import { CardGridSkeleton } from "@/components/ui/card-grid-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import type { RecipeCatalogStats } from "@/lib/domain/recipe/recipeViews";

type VisibleRecipeCountState = {
  userId: string | null;
  count: number;
};

type RecipeCatalogStatsState = RecipeCatalogStats & {
  userId: string | null;
};

function formatCount(count: number, singular: string, plural: string) {
  const label = count === 1 ? singular : plural;
  return `${count.toLocaleString()} ${label}`;
}

function formatRecipeCount(count: number | null) {
  return count == null ? null : formatCount(count, "recipe", "recipes");
}

function formatCatalogCount(count: number, singular: string, plural: string) {
  return count > 0 ? formatCount(count, singular, plural) : null;
}

export function RecipeBoxView() {
  const { data: session, isPending } = authClient.useSession();
  const sessionUserId = session?.user.id ?? null;
  const [countState, setCountState] = useState<VisibleRecipeCountState | null>(
    null,
  );
  const [catalogStatsState, setCatalogStatsState] =
    useState<RecipeCatalogStatsState | null>(null);
  const updateVisibleRecipeCount = useCallback(
    (count: number) => setCountState({ userId: sessionUserId, count }),
    [sessionUserId],
  );
  const updateCatalogStats = useCallback(
    (stats: RecipeCatalogStats) =>
      setCatalogStatsState({ userId: sessionUserId, ...stats }),
    [sessionUserId],
  );
  const visibleRecipeCount =
    !isPending && countState?.userId === sessionUserId
      ? countState.count
      : null;
  const recipeCountLabel = formatRecipeCount(visibleRecipeCount);
  const catalogStats = useMemo(() => {
    if (
      isPending ||
      catalogStatsState?.userId !== sessionUserId ||
      recipeCountLabel == null
    ) {
      return null;
    }
    const { cuisineCount, ingredientCount, equipmentCount } = catalogStatsState;
    return [
      recipeCountLabel,
      formatCatalogCount(cuisineCount, "cuisine", "cuisines"),
      formatCatalogCount(ingredientCount, "ingredient", "ingredients"),
      formatCatalogCount(equipmentCount, "tool", "tools"),
    ].filter((stat): stat is string => stat != null);
  }, [catalogStatsState, isPending, recipeCountLabel, sessionUserId]);

  return (
    <div className="container mx-auto min-h-screen max-w-7xl px-4 pt-5 pb-10 md:pt-7 md:pb-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <div>
          <p className="rt-mono text-[var(--terracotta)]">Your recipe box</p>
          <h1 className="rt-display mt-2 text-5xl sm:text-6xl lg:text-7xl">
            What's <span className="text-[var(--terracotta)]">cooking?</span>
          </h1>
          <div className="rt-body mt-3 flex flex-wrap gap-x-2 gap-y-1 text-base leading-snug text-[var(--ink-2)] sm:text-lg">
            {catalogStats == null ? (
              <Skeleton
                aria-label="Loading recipe stats"
                className="h-5 w-52"
              />
            ) : (
              catalogStats.map((stat, index) => (
                <span key={stat} className="whitespace-nowrap">
                  {stat}
                  {index < catalogStats.length - 1 && (
                    <span className="text-[var(--ink-3)]"> ·</span>
                  )}
                </span>
              ))
            )}
          </div>
        </div>
        <AddRecipeButton />
      </div>

      <Suspense fallback={<CardGridSkeleton variant="filters" />}>
        <RecipeCollection
          onCatalogStatsChange={updateCatalogStats}
          onDietVisibleCountChange={updateVisibleRecipeCount}
        />
      </Suspense>
    </div>
  );
}
