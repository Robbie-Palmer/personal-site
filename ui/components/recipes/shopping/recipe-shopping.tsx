"use client";

import { Loader2 } from "lucide-react";
import { RecipeAuthRequired } from "@/components/recipes/recipe-auth-required";
import { ShoppingView } from "@/components/recipes/shopping/shopping-view";
import { useAbortableLoad } from "@/hooks/use-abortable-load";
import { fetchRecipeBoxRecipes } from "@/lib/api/saved-recipes";
import {
  recipeRecordsToShoppingRecipes,
  type ShoppingRecipe,
} from "@/lib/api/shopping";
import { authClient } from "@/lib/auth-client";

async function loadShoppingRecipes(
  signal: AbortSignal,
): Promise<ShoppingRecipe[]> {
  const { recipes } = await fetchRecipeBoxRecipes(signal);
  return recipeRecordsToShoppingRecipes(recipes);
}

export function RecipeShopping() {
  const { data: session, isPending } = authClient.useSession();
  const { data: recipes, error } = useAbortableLoad(
    session?.user.id ?? null,
    loadShoppingRecipes,
    "Shopping recipes could not be loaded",
  );

  if (isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-[var(--terracotta)]" />
      </div>
    );
  }
  if (!session) {
    return (
      <RecipeAuthRequired
        title="Log in to make a list"
        description="Your shopping list is built from the recipes in your box."
      />
    );
  }

  if (error) {
    return (
      <p className="rt-body p-8 text-center">
        Your recipes could not be loaded.
      </p>
    );
  }
  if (!recipes) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-[var(--terracotta)]" />
      </div>
    );
  }
  return <ShoppingView recipes={recipes} />;
}
