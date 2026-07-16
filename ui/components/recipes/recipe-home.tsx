"use client";

import { LoggedOutLanding } from "@/components/recipes/logged-out-landing";
import { RecipeBoxView } from "@/components/recipes/recipe-box-view";
import type { RecipeCardView } from "@/lib/api/recipes";
import { authClient } from "@/lib/auth-client";

export function RecipeHome({
  recipes,
  catalogStats,
}: Readonly<{
  recipes: RecipeCardView[];
  catalogStats: string[];
}>) {
  const { data: session } = authClient.useSession();

  if (session) {
    return <RecipeBoxView recipes={recipes} catalogStats={catalogStats} />;
  }

  return <LoggedOutLanding recipes={recipes} />;
}
