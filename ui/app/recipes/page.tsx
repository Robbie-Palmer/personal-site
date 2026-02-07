import type { Metadata } from "next";
import { Suspense } from "react";
import { RecipeList } from "@/components/recipes/recipe-list";
import { CardGridSkeleton } from "@/components/ui/card-grid-skeleton";
import { getAllRecipes } from "@/lib/api/recipes";

export const metadata: Metadata = {
  title: "All Recipes",
  description: "Browse all of my favorite recipes",
};

export default function RecipesPage() {
  const recipes = getAllRecipes();

  return (
    <div className="container mx-auto px-4 py-12 min-h-screen max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Recipes</h1>
        <p className="text-xl text-muted-foreground">
          A collection of my favorite recipes
        </p>
      </div>

      <Suspense fallback={<CardGridSkeleton />}>
        <RecipeList recipes={recipes} />
      </Suspense>
    </div>
  );
}
