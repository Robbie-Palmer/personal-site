"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AddRecipeView } from "@/components/recipes/add-recipe-view";
import { Button } from "@/components/ui/button";
import type { SavedRecipeApiRecord } from "@/lib/domain/recipe/recipeDraft";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; recipe: SavedRecipeApiRecord };

export function EditRecipeView() {
  const slug = useSearchParams().get("slug");
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setState({ status: "error", message: "No recipe was selected." });
      return;
    }
    const controller = new AbortController();
    void fetch(`/api/recipes/${encodeURIComponent(slug)}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("The recipe could not be loaded.");
        return (await response.json()) as SavedRecipeApiRecord;
      })
      .then((recipe) => {
        if (!recipe.owned)
          throw new Error("Only the recipe owner can edit it.");
        setState({ status: "ready", recipe });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "The recipe could not be loaded.",
        });
      });
    return () => controller.abort();
  }, [slug]);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-[var(--terracotta)]" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="container mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="rt-display text-5xl">Recipe unavailable</h1>
        <p className="rt-body mt-3 text-[var(--ink-2)]">{state.message}</p>
        <Button asChild variant="outline" className="mt-6 rounded-full">
          <Link href="/recipes">
            <ArrowLeft /> Back to recipes
          </Link>
        </Button>
      </div>
    );
  }
  return <AddRecipeView initialRecipe={state.recipe} />;
}
