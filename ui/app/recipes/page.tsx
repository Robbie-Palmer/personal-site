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
  const recipeCountLabel = recipes.length.toLocaleString() + " " + (recipes.length === 1 ? "recipe" : "recipes");

  return (
    <div className="container mx-auto px-4 py-12 min-h-screen max-w-6xl">
      <JsonLdScript data={jsonLd} />
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Recipes</h1>
        <p className="text-xl text-muted-foreground">
          A collection of my favorite recipes
        </p>
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          {recipeCountLabel}
        </p>
      </div>

      <Suspense fallback={<CardGridSkeleton />}>
        <RecipeList recipes={recipes} />
      </Suspense>
    </div>
  );
}
