"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { LoggedOutLanding } from "@/components/recipes/logged-out-landing";
import { RecipeBoxView } from "@/components/recipes/recipe-box-view";
import { RecipeHomeSkeleton } from "@/components/recipes/recipe-home-skeleton";
import { RecipeQueryStatus } from "@/components/recipes/recipe-load-state";
import { authClient } from "@/lib/auth-client";
import { publicRecipesQuery } from "@/lib/query/recipe-queries";

export function RecipeHome() {
  const { data: session, isPending } = authClient.useSession();
  const publicRecipes = useQuery({
    ...publicRecipesQuery(),
    enabled: !isPending && !session,
  });

  useEffect(() => {
    if (isPending) return;
    document.title = session
      ? "Your recipe box | Robbie's Recipes"
      : "Recipes for real life | Robbie's Recipes";
  }, [isPending, session]);

  if (isPending || (!session && publicRecipes.isPending)) {
    return <RecipeHomeSkeleton />;
  }
  if (session) return <RecipeBoxView />;
  const hasPublicRecipes = publicRecipes.data !== undefined;
  const queryStatus = (
    <RecipeQueryStatus
      error={publicRecipes.error}
      hasData={hasPublicRecipes}
      isFetching={publicRecipes.isFetching}
      isStale={publicRecipes.isStale}
      subject="public recipes"
    />
  );

  if (!hasPublicRecipes) return queryStatus;

  return (
    <>
      {queryStatus}
      <LoggedOutLanding recipes={publicRecipes.data} />
    </>
  );
}
