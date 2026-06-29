"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
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

  return (
    <search className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!onList) router.push("/recipes");
        }}
        className="flex items-center gap-2 rounded-full border-[1.5px] border-foreground/80 bg-card px-4 py-2 transition-colors focus-within:border-[var(--terracotta)]"
      >
        <Search className="h-4 w-4 text-[var(--ink-3)]" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search recipes…"
          aria-label="Search recipes"
          className="min-w-0 flex-1 bg-transparent text-[0.95rem] outline-none placeholder:text-[var(--ink-4)]"
        />
      </form>
    </search>
  );
}
