"use client";

import { LoaderCircle } from "lucide-react";
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
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <output
        aria-label="Loading recipes"
        className="flex min-h-[60vh] items-center justify-center"
      >
        <LoaderCircle className="size-6 animate-spin text-[var(--terracotta)]" />
      </output>
    );
  }

  if (session) {
    return <RecipeBoxView recipes={recipes} catalogStats={catalogStats} />;
  }

  return <LoggedOutLanding recipes={recipes} />;
}
