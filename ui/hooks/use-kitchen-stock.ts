"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type Pantry,
  removePantryItem,
  replacePantry,
  restorePantry,
  setPantryItem,
} from "@/lib/api/pantry";
import { captureRecipeProductActivity } from "@/lib/analytics/recipe-product";
import { authClient } from "@/lib/auth-client";
import type { IngredientSlug } from "@/lib/domain/recipe/ingredient";
import type {
  KitchenLocation,
  KitchenStock,
} from "@/lib/domain/recipe/kitchen";
import { pantryQuery } from "@/lib/query/pantry-queries";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";

const EMPTY_STOCK: KitchenStock = {};

type PantryMutation =
  | {
      kind: "set";
      ingredientSlug: IngredientSlug;
      location: KitchenLocation;
    }
  | {
      kind: "remove";
      ingredientSlug: IngredientSlug;
    }
  | {
      kind: "replace";
      stock: KitchenStock;
    }
  | {
      kind: "restore";
      stock: KitchenStock;
    };

export function useKitchenStockQuery() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const userId = session?.user.id;
  return useQuery({
    ...pantryQuery(userId ?? "pending"),
    enabled: !sessionPending && Boolean(userId),
  });
}

export function useKitchenStock(): KitchenStock {
  return useKitchenStockQuery().data?.stock ?? EMPTY_STOCK;
}

export function useKitchenStockActions() {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id ?? "pending";
  const queryClient = useQueryClient();
  const queryKey = recipeQueryKeys.pantry(userId);
  const mutation = useMutation({
    mutationKey: [...queryKey, "save"],
    scope: { id: `pantry:${userId}` },
    mutationFn: (operation: PantryMutation) => {
      switch (operation.kind) {
        case "set":
          return setPantryItem(operation.ingredientSlug, operation.location);
        case "remove":
          return removePantryItem(operation.ingredientSlug);
        case "replace":
          return replacePantry(operation.stock);
        case "restore":
          return restorePantry(operation.stock);
      }
    },
    onMutate: async (operation) => {
      await queryClient.cancelQueries({ queryKey, exact: true });
      const previous = queryClient.getQueryData<Pantry>(queryKey);
      if (previous) {
        let optimisticStock: KitchenStock;
        switch (operation.kind) {
          case "set":
            optimisticStock = {
              ...previous.stock,
              [operation.ingredientSlug]: operation.location,
            };
            break;
          case "remove":
            optimisticStock = { ...previous.stock };
            delete optimisticStock[operation.ingredientSlug];
            break;
          case "replace":
            optimisticStock = { ...operation.stock };
            break;
          case "restore":
            optimisticStock = { ...operation.stock, ...previous.stock };
            break;
        }
        queryClient.setQueryData<Pantry>(queryKey, {
          ...previous,
          stock: optimisticStock,
        });
      }
      return { previous };
    },
    onError: (_error, _operation, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: (pantry) => {
      queryClient.setQueryData(queryKey, pantry);
    },
  });

  return {
    clearStock() {
      mutation.mutate({ kind: "replace", stock: {} });
    },
    error: mutation.error,
    isPending: mutation.isPending,
    removeFromStock(ingredientSlug: IngredientSlug) {
      mutation.mutate({ kind: "remove", ingredientSlug });
    },
    replaceStock(stock: KitchenStock) {
      mutation.mutate({ kind: "replace", stock: { ...stock } });
    },
    restoreStock(stock: KitchenStock) {
      mutation.mutate({
        kind: "restore",
        stock: { ...stock },
      });
    },
    setStockLocation(
      ingredientSlug: IngredientSlug,
      location: KitchenLocation,
    ) {
      const stock =
        queryClient.getQueryData<Pantry>(queryKey)?.stock ?? EMPTY_STOCK;
      const optimisticStock = {
        ...stock,
        [ingredientSlug]: location,
      };
      if (stock[ingredientSlug] !== location) {
        captureRecipeProductActivity("kitchen_ingredient_added", {
          ingredient_slug: ingredientSlug,
          kitchen_location: location,
          stocked_ingredient_count: Object.keys(optimisticStock).length,
        });
      }
      mutation.mutate({
        kind: "set",
        ingredientSlug,
        location,
      });
    },
  };
}
