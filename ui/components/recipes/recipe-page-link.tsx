import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { isRecipeAppRouteSlug } from "recipe-domain/slugs";
import {
  recipePageHref,
  type SavedRecipeApiRecord,
} from "@/lib/domain/recipe/recipeDraft";

type RecipePageLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  href: string;
};

const RECIPE_PATH = /^\/recipes\/([^/]+)$/;

function decodedRecipeSlug(href: string): string | null {
  const segment = RECIPE_PATH.exec(href)?.[1];
  if (!segment) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Recipe detail pages are resolved by a Cloudflare Pages Function rather than
 * Next's static route manifest. They therefore need a document navigation;
 * Next's client router would otherwise resolve the runtime URL as a 404.
 */
export function RecipePageLink({
  href,
  ...props
}: Readonly<RecipePageLinkProps>) {
  const slug = decodedRecipeSlug(href);
  if (slug && !isRecipeAppRouteSlug(slug)) {
    return <a href={href} {...props} />;
  }
  return <Link href={href} {...props} />;
}

export function navigateToRecipePage(
  recipe: Pick<SavedRecipeApiRecord, "slug">,
) {
  window.location.assign(recipePageHref(recipe));
}

export function replaceWithRecipePage(
  recipe: Pick<SavedRecipeApiRecord, "slug">,
) {
  window.location.replace(recipePageHref(recipe));
}
