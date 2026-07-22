"use client";

import { ArrowLeft, Loader2, LockKeyhole, Pencil } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RecipeContent } from "@/components/recipes/recipe-content";
import { Button } from "@/components/ui/button";
import {
  parseSavedRecipe,
  type SavedRecipeApiRecord,
} from "@/lib/domain/recipe/recipeDraft";
import type { RecipeDetailView } from "@/lib/domain/recipe/recipeViews";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      recipe: RecipeDetailView;
      visibility: SavedRecipeApiRecord["visibility"];
      owned: boolean;
    };

export function SavedRecipeView() {
  const pathname = usePathname();
  const searchSlug = useSearchParams().get("slug");
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const pathSlug = /^\/recipes\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(
      pathname,
    )?.[1];
    const slug = searchSlug ?? pathSlug;
    if (
      !slug ||
      slug.length > 120 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    ) {
      setState({ status: "error", message: "No saved recipe was selected." });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading" });
    void fetch(`/api/recipes/${encodeURIComponent(slug)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404)
          throw new Error(
            "That recipe was not found, or it belongs to another profile.",
          );
        if (!response.ok) throw new Error("The recipe could not be loaded.");
        try {
          return (await response.json()) as SavedRecipeApiRecord;
        } catch {
          throw new Error("The recipe could not be loaded.");
        }
      })
      .then((record) => {
        const recipe = parseSavedRecipe(record);
        if (!recipe)
          throw new Error("The saved recipe is not in a supported format.");
        setState({
          status: "ready",
          recipe,
          visibility: record.visibility,
          owned: record.owned === true,
        });
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
  }, [pathname, searchSlug]);

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
        <h1 className="rt-display text-5xl">Recipe not found</h1>
        <p className="rt-body mt-3 text-[var(--ink-2)]">{state.message}</p>
        <Button asChild variant="outline" className="mt-6 rounded-full">
          <Link href="/recipes">
            <ArrowLeft /> Back to recipes
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto min-h-screen max-w-5xl px-4 py-5 md:py-8">
      <div className="mb-5 flex items-center justify-between gap-4">
        <Link
          href="/recipes"
          className="rt-mono inline-flex items-center gap-1 text-[var(--ink-3)] hover:text-[var(--terracotta)]"
        >
          <ArrowLeft className="size-3.5" /> All recipes
        </Link>
        <div className="flex items-center gap-2">
          {state.owned && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-full"
            >
              <Link
                href={`/recipes/edit?slug=${encodeURIComponent(state.recipe.slug)}`}
              >
                <Pencil /> Edit recipe
              </Link>
            </Button>
          )}
          <span className="rt-mono inline-flex items-center gap-1.5 rounded-full border border-[var(--line-strong)] bg-[var(--paper-warm)] px-3 py-1 text-[var(--ink-3)]">
            <LockKeyhole className="size-3" /> {state.visibility}
          </span>
        </div>
      </div>
      <RecipeContent recipe={state.recipe} />
    </div>
  );
}
