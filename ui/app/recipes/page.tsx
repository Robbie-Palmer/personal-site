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
  const ingredientCount = new Set(
    recipes.flatMap((recipe) => recipe.ingredientNames),
  ).size;
  const cookwareCount = new Set(recipes.flatMap((recipe) => recipe.cookware))
    .size;
  const stats = [
    `${recipeCount.toLocaleString()} ${recipeCount === 1 ? "recipe" : "recipes"}`,
    cuisineCount > 0 &&
      `${cuisineCount} ${cuisineCount === 1 ? "cuisine" : "cuisines"}`,
    `${ingredientCount} ${ingredientCount === 1 ? "ingredient" : "ingredients"}`,
    `${cookwareCount} ${cookwareCount === 1 ? "tool" : "tools"}`,
  ].filter((stat): stat is string => Boolean(stat));

  return (
    <div className="container mx-auto px-4 pt-5 pb-10 md:pt-7 md:pb-14 min-h-screen max-w-7xl">
      <JsonLdScript data={jsonLd} />
      <div className="mb-6 md:mb-8">
        <p className="rt-mono text-[var(--terracotta)]">Your recipe box</p>
        <h1 className="rt-display text-5xl sm:text-6xl lg:text-7xl mt-2">
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
        <RecipeList recipes={recipes} />
      </Suspense>
    </div>
  );
}
