"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useRecipeSearch } from "@/contexts/recipe-search-context";

const URL_SYNC_DEBOUNCE_MS = 300;

/**
 * Bridges the in-memory recipe search query and the `?q=` URL param, so search
 * stays instant *and* shareable:
 *
 * - Hydrates the query from `?q=` once on mount, so a shared/refreshed
 *   `/recipes?q=…` link restores the active search.
 * - Reflects the query back into the URL on the list page via a debounced
 *   `router.replace` — the list already filters from context, so the URL write
 *   only needs to settle for shareability and never runs per keystroke.
 *
 * Kept as its own component (rendered inside a Suspense boundary) because
 * `useSearchParams` triggers a client-render bailout for everything above it.
 */
export function RecipeSearchUrlSync() {
  const { query, setQuery } = useRecipeSearch();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hydrated = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: hydrate once on mount
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    if (q) setQuery(q);
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    if (pathname !== "/recipes") return;
    if ((searchParams.get("q") ?? "") === query) return;
    const id = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query) {
        params.set("q", query);
      } else {
        params.delete("q");
      }
      const qs = params.toString();
      router.replace(`/recipes${qs ? `?${qs}` : ""}`, { scroll: false });
    }, URL_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query, pathname, searchParams, router]);

  return null;
}
