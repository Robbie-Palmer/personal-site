"use client";

import { Suspense, useCallback, useState } from "react";
import { AddRecipeButton } from "@/components/recipes/add-recipe-button";
import { RecipeCollection } from "@/components/recipes/recipe-collection";
import { CardGridSkeleton } from "@/components/ui/card-grid-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import type { RecipeCardView } from "@/lib/api/recipes";

function formatRecipeCount(count: number | null) {
  if (count == null) return null;
  const label = count === 1 ? "recipe" : "recipes";
  return `${count.toLocaleString()} ${label}`;
}

export function RecipeBoxView({
  recipes,
  catalogStats,
}: Readonly<{
  recipes: RecipeCardView[];
  catalogStats: string[];
}>) {
  const [visibleRecipeCount, setVisibleRecipeCount] = useState<number | null>(
    null,
  );
  const updateVisibleRecipeCount = useCallback(
    (count: number) => setVisibleRecipeCount(count),
    [],
  );
  const recipeCountLabel = formatRecipeCount(visibleRecipeCount);
  const stats = recipeCountLabel
    ? [recipeCountLabel, ...catalogStats]
    : catalogStats;

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
              stats.map((stat, index) => (
                <span key={stat} className="whitespace-nowrap">
                  {stat}
                  {index < stats.length - 1 && (
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
          recipes={recipes}
          onDietVisibleCountChange={updateVisibleRecipeCount}
        />
      </Suspense>
    </div>
  );
}
