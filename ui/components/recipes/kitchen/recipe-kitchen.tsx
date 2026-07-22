"use client";

import { Loader2 } from "lucide-react";
import { KitchenView } from "@/components/recipes/kitchen/kitchen-view";
import { RecipeAuthRequired } from "@/components/recipes/recipe-auth-required";
import { useAbortableLoad } from "@/hooks/use-abortable-load";
import { buildKitchenCatalog } from "@/lib/api/recipes";
import { fetchRecipeBoxRecipes } from "@/lib/api/saved-recipes";
import { authClient } from "@/lib/auth-client";

type Catalog = ReturnType<typeof buildKitchenCatalog>;

async function loadKitchenCatalog(signal: AbortSignal): Promise<Catalog> {
  const { recipes } = await fetchRecipeBoxRecipes(signal);
  return buildKitchenCatalog(recipes);
}

export function RecipeKitchen() {
  const { data: session, isPending } = authClient.useSession();
  const { data: catalog, error } = useAbortableLoad(
    session?.user.id ?? null,
    loadKitchenCatalog,
    "Kitchen recipes could not be loaded",
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
        title="Your kitchen is waiting"
        description="Log in to stock your kitchen from the recipes in your box."
      />
    );
  }

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
