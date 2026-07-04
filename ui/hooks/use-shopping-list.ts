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

/** The number of selected recipes — used for the nav badge. */
export function useSelectedRecipeCount(): number {
  const state = useShoppingList();
  return state.recipes.length;
}
