"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ShoppingView } from "@/components/recipes/shopping/shopping-view";
import { fetchRecipeBoxRecipes } from "@/lib/api/saved-recipes";
import {
  recipeRecordsToShoppingRecipes,
  type ShoppingRecipe,
} from "@/lib/api/shopping";

export function RecipeShopping() {
  const [recipes, setRecipes] = useState<ShoppingRecipe[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetchRecipeBoxRecipes(controller.signal)
      .then((box) => setRecipes(recipeRecordsToShoppingRecipes(box.recipes)))
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        )
          return;
        console.error("Shopping recipes could not be loaded", loadError);
        setError(true);
      });
    return () => controller.abort();
  }, []);

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
