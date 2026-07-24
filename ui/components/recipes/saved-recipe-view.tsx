"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LockKeyhole, Pencil } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { isRecipeSlug, recipeSlugFromPathname } from "recipe-domain/slugs";
import { RecipeContent } from "@/components/recipes/recipe-content";
import {
  errorMessage,
  RecipeLoadError,
  RecipeLoading,
  RecipeQueryStatus,
} from "@/components/recipes/recipe-load-state";
import { replaceWithRecipePage } from "@/components/recipes/recipe-page-link";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { parseSavedRecipe } from "@/lib/domain/recipe/recipeDraft";
import { savedRecipeQuery } from "@/lib/query/recipe-queries";

export function SavedRecipeView() {
  const pathname = usePathname();
  const searchSlug = useSearchParams().get("slug");
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const pathSlug = recipeSlugFromPathname(pathname);
  const slug =
    pathname === "/recipes/saved" ? searchSlug : (searchSlug ?? pathSlug);
  const validSlug = isRecipeSlug(slug);
  const needsRedirect =
    pathname === "/recipes/saved" && Boolean(searchSlug && validSlug);
  const result = useQuery({
    ...savedRecipeQuery(session?.user.id ?? "anonymous", slug ?? "invalid"),
    enabled: !sessionPending && validSlug && !needsRedirect,
  });

  useEffect(() => {
    if (needsRedirect && searchSlug) {
      replaceWithRecipePage({ slug: searchSlug });
    }
  }, [needsRedirect, searchSlug]);

  if (!validSlug) {
    return (
      <RecipeLoadError
        title="Recipe not found"
        message="No saved recipe was selected."
      />
    );
  }
  if (sessionPending || needsRedirect || result.isPending) {
    return <RecipeLoading />;
  }
  if (result.isError && result.data === undefined) {
    return (
      <RecipeLoadError
        title="Recipe not found"
        message={errorMessage(result.error, "The recipe could not be loaded.")}
      />
    );
  }
  const recipe = parseSavedRecipe(result.data);
  if (!recipe) {
    return (
      <RecipeLoadError
        title="Recipe not found"
        message="The saved recipe is not in a supported format."
      />
    );
  }

  return (
    <>
      <RecipeQueryStatus
        error={result.error}
        hasData
        isFetching={result.isFetching}
        isStale={result.isStale}
        subject="this recipe"
      />
      <div className="container mx-auto min-h-screen max-w-5xl px-4 py-5 md:py-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Link
            href="/recipes"
            className="rt-mono inline-flex items-center gap-1 text-[var(--ink-3)] hover:text-[var(--terracotta)]"
          >
            <ArrowLeft className="size-3.5" /> All recipes
          </Link>
          <div className="flex items-center gap-2">
            {result.data.owned === true && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-full"
              >
                <Link
                  href={`/recipes/edit?slug=${encodeURIComponent(recipe.slug)}`}
                >
                  <Pencil /> Edit recipe
                </Link>
              </Button>
            )}
            <span className="rt-mono inline-flex items-center gap-1.5 rounded-full border border-[var(--line-strong)] bg-[var(--paper-warm)] px-3 py-1 text-[var(--ink-3)]">
              <LockKeyhole className="size-3" /> {result.data.visibility}
            </span>
          </div>
        </div>
        <RecipeContent recipe={recipe} />
      </div>
    </>
  );
}
