"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { KitchenView } from "@/components/recipes/kitchen/kitchen-view";
import { buildKitchenCatalog } from "@/lib/api/recipes";
import { fetchRecipeBoxRecipes } from "@/lib/api/saved-recipes";

type Catalog = ReturnType<typeof buildKitchenCatalog>;

export function RecipeKitchen() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetchRecipeBoxRecipes(controller.signal)
      .then(({ recipes }) => setCatalog(buildKitchenCatalog(recipes)))
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        )
          return;
        console.error("Kitchen recipes could not be loaded", loadError);
        setError(true);
      });
    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <p className="rt-body p-8 text-center">
        Your kitchen could not be loaded.
      </p>
    );
  }
  if (!catalog) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-[var(--terracotta)]" />
      </div>
    );
  }
  return <KitchenView {...catalog} />;
}
