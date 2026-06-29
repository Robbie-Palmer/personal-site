"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import { useRecipeSearch } from "@/contexts/recipe-search-context";

/**
 * The recipe-box search lives in the nav (as in the designs) and updates an
 * in-memory context, so live filtering on the list is instant. On a recipe
 * detail page there is no list to filter, so submitting navigates to the list
 * (the typed query already lives in the shared context).
 */
export function RecipeSearch() {
  const { query, setQuery } = useRecipeSearch();
  const router = useRouter();
  const pathname = usePathname();
  const onList = pathname === "/recipes";
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <search className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          // Collapse the on-screen keyboard on mobile once results are showing.
          inputRef.current?.blur();
          // From a detail page, jump to the list — carrying the query so the
          // destination URL is shareable straight away.
          if (!onList) {
            const trimmed = query.trim();
            router.push(
              trimmed
                ? `/recipes?q=${encodeURIComponent(trimmed)}`
                : "/recipes",
            );
          }
        }}
        className="flex items-center gap-2 rounded-full border-[1.5px] border-foreground/80 bg-card px-4 py-2 transition-colors focus-within:border-[var(--terracotta)]"
      >
        <Search className="h-4 w-4 text-[var(--ink-3)]" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search recipes…"
          aria-label="Search recipes"
          className="min-w-0 flex-1 bg-transparent text-[0.95rem] outline-hidden placeholder:text-[var(--ink-4)]"
        />
      </form>
    </search>
  );
}
