"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

interface RecipeSearchValue {
  query: string;
  setQuery: (query: string) => void;
}

// Default value keeps consumers working without a provider (e.g. in unit tests
// that render RecipeList in isolation): search is simply inert.
const RecipeSearchContext = createContext<RecipeSearchValue>({
  query: "",
  setQuery: () => {},
});

/**
 * Holds the recipe search query in memory, shared between the nav search box
 * and the recipe list. Kept out of the URL deliberately: routing on every
 * keystroke made live filtering feel laggy. The provider lives in the recipes
 * layout, which persists across list <-> detail navigation, so a query typed on
 * a detail page survives the jump back to the list.
 */
export function RecipeSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const value = useMemo(() => ({ query, setQuery }), [query]);
  return (
    <RecipeSearchContext.Provider value={value}>
      {children}
    </RecipeSearchContext.Provider>
  );
}

export function useRecipeSearch(): RecipeSearchValue {
  return useContext(RecipeSearchContext);
}
