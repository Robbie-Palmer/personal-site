"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { KitchenView } from "@/components/recipes/kitchen/kitchen-view";
import { RecipeAuthRequired } from "@/components/recipes/recipe-auth-required";
import { RecipeQueryStatus } from "@/components/recipes/recipe-load-state";
import { buildKitchenCatalog } from "@/lib/api/recipes";
import { authClient } from "@/lib/auth-client";
import { recipeBoxRecipesQuery } from "@/lib/query/recipe-queries";

export function RecipeKitchen() {
  const { data: session, isPending } = authClient.useSession();
  const recipeBox = useQuery({
    ...recipeBoxRecipesQuery(session?.user.id ?? "pending"),
    enabled: !isPending && Boolean(session),
    select: ({ recipes }) => buildKitchenCatalog(recipes),
  });

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

  if (recipeBox.isError && recipeBox.data === undefined) {
    return (
      <p className="rt-body p-8 text-center">
        Your kitchen could not be loaded.
      </p>
    );
  }
  if (recipeBox.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-[var(--terracotta)]" />
      </div>
    );
  }
  return (
    <>
      <RecipeQueryStatus
        error={recipeBox.error}
        hasData
        isFetching={recipeBox.isFetching}
        isStale={recipeBox.isStale}
        subject="your kitchen"
      />
      <KitchenView {...recipeBox.data} />
    </>
  );
}
