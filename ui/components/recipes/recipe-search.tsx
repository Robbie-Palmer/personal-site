"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The recipe-box search lives in the nav (as in the designs). It is wired to a
 * `?q=` URL param so it is the same search the recipe list already had, just
 * relocated and shareable:
 *
 * - On the list page (`/recipes`) it live-updates the param as you type, and
 *   `RecipeList` reads `?q=` to filter.
 * - On a recipe detail page it does nothing until you submit, then navigates to
 *   the list with the query applied.
 */
export function RecipeSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onList = pathname === "/recipes";
  const committed = searchParams.get("q") ?? "";
  const [draft, setDraft] = useState(committed);

  // Keep the input in sync when the param changes elsewhere (back/forward, the
  // list's "clear" affordances, navigating between pages).
  useEffect(() => {
    setDraft(committed);
  }, [committed]);

  function commit(value: string) {
    const params = new URLSearchParams(onList ? searchParams.toString() : "");
    if (value) {
      params.set("q", value);
    } else {
      params.delete("q");
    }
    const qs = params.toString();
    const url = `/recipes${qs ? `?${qs}` : ""}`;
    if (onList) {
      router.replace(url, { scroll: false });
    } else {
      router.push(url);
    }
  }

  return (
    <search className="w-full sm:w-56 md:w-64">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commit(draft.trim());
        }}
        className="flex items-center gap-2 rounded-full border-[1.5px] border-foreground/80 bg-card px-4 py-2 transition-colors focus-within:border-[var(--terracotta)]"
      >
        <Search className="h-4 w-4 text-[var(--ink-3)]" aria-hidden="true" />
        <input
          type="search"
          value={draft}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            if (onList) commit(next.trim());
          }}
          placeholder="search recipes…"
          aria-label="Search recipes"
          className="min-w-0 flex-1 bg-transparent text-[0.95rem] outline-none placeholder:text-[var(--ink-4)]"
        />
      </form>
    </search>
  );
}
