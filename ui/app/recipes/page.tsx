import type { Metadata } from "next";
import { Suspense } from "react";
import { RecipeList } from "@/components/recipes/recipe-list";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import { CardGridSkeleton } from "@/components/ui/card-grid-skeleton";
import { getAllRecipes } from "@/lib/api/recipes";
import { siteConfig } from "@/lib/config/site-config";
import { buildRecipeListJsonLd } from "@/lib/seo/recipe-jsonld";

export const metadata: Metadata = {
  title: "All Recipes",
  description: "Browse all of my favorite recipes",
};

export default function RecipesPage() {
  const recipes = getAllRecipes();
  const jsonLd = buildRecipeListJsonLd(recipes, siteConfig.url);

  const recipeCount = recipes.length;
  const cuisineCount = new Set(recipes.flatMap((recipe) => recipe.cuisine))
    .size;
  const stats = [
    `${recipeCount.toLocaleString()} ${recipeCount === 1 ? "recipe" : "recipes"}`,
    cuisineCount > 0 &&
      `${cuisineCount} ${cuisineCount === 1 ? "cuisine" : "cuisines"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="container mx-auto px-4 py-10 md:py-14 min-h-screen max-w-7xl">
      <JsonLdScript data={jsonLd} />
      <div className="mb-8">
        <p className="rt-mono text-[var(--terracotta)]">Your recipe box</p>
        <h1 className="rt-display text-6xl md:text-7xl mt-2">
          What's <span className="text-[var(--terracotta)]">cooking?</span>
        </h1>
        <p className="rt-body mt-3 text-lg text-[var(--ink-2)]">{stats}</p>
      </div>

      <Suspense fallback={<CardGridSkeleton variant="filters" />}>
        <RecipeList recipes={recipes} />
      </Suspense>
    </div>
  );
}
