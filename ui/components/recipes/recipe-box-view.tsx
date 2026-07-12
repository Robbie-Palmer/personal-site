"use client";

import { Suspense, useCallback, useState } from "react";
import { RecipeList } from "@/components/recipes/recipe-list";
import { CardGridSkeleton } from "@/components/ui/card-grid-skeleton";
import type { RecipeCardView } from "@/lib/api/recipes";

export function RecipeBoxView({
  recipes,
  catalogStats,
}: Readonly<{
  recipes: RecipeCardView[];
  catalogStats: string[];
}>) {
  const [visibleRecipeCount, setVisibleRecipeCount] = useState(recipes.length);
  const updateVisibleRecipeCount = useCallback(
    (count: number) => setVisibleRecipeCount(count),
    [],
  );
  const recipeCountLabel = `${visibleRecipeCount.toLocaleString()} ${
    visibleRecipeCount === 1 ? "recipe" : "recipes"
  }`;
  const stats = [recipeCountLabel, ...catalogStats];

  return (
    <div className="container mx-auto min-h-screen max-w-7xl px-4 pt-5 pb-10 md:pt-7 md:pb-14">
      <div className="mb-6 md:mb-8">
        <p className="rt-mono text-[var(--terracotta)]">Your recipe box</p>
        <h1 className="rt-display mt-2 text-5xl sm:text-6xl lg:text-7xl">
          What's <span className="text-[var(--terracotta)]">cooking?</span>
        </h1>
        <p className="rt-body mt-3 flex flex-wrap gap-x-2 gap-y-1 text-base leading-snug text-[var(--ink-2)] sm:text-lg">
          {stats.map((stat, index) => (
            <span key={stat} className="whitespace-nowrap">
              {stat}
              {index < stats.length - 1 && (
                <span className="text-[var(--ink-3)]"> ·</span>
              )}
            </span>
          ))}
        </p>
      </div>

      <Suspense fallback={<CardGridSkeleton variant="filters" />}>
        <RecipeList
          recipes={recipes}
          onDietVisibleCountChange={updateVisibleRecipeCount}
        />
      </Suspense>
    </div>
  );
}
