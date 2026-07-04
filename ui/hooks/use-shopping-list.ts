"use client";

import { useSyncExternalStore } from "react";
import {
  getServerShoppingListSnapshot,
  getShoppingListSnapshot,
  type ShoppingListState,
  subscribeShoppingList,
} from "@/lib/shopping/shoppingListStore";

export function useShoppingList(): ShoppingListState {
  return useSyncExternalStore(
    subscribeShoppingList,
    getShoppingListSnapshot,
    getServerShoppingListSnapshot,
  );
}

/**
 * The number of selected recipes — used for the nav badge. Subscribes to the
 * count directly (a primitive snapshot) so the nav bar doesn't re-render when
 * unrelated state changes, e.g. ticking off an ingredient.
 */
export function useSelectedRecipeCount(): number {
  return useSyncExternalStore(
    subscribeShoppingList,
    () => getShoppingListSnapshot().recipes.length,
    () => 0,
  );
}
