"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  discardLegacyPantry,
  importLegacyPantry,
  type Pantry,
  removePantryItem,
  replacePantry,
  restorePantry,
  setPantryItem,
} from "@/lib/api/pantry";
import { authClient } from "@/lib/auth-client";
import type { IngredientSlug } from "@/lib/domain/recipe/ingredient";
import type { KitchenLocation } from "@/lib/domain/recipe/kitchen";
import type { KitchenStock } from "@/lib/kitchen/kitchenStockStore";
import { pantryQuery } from "@/lib/query/pantry-queries";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";

const EMPTY_STOCK: KitchenStock = {};

type PantryMutation =
  | {
      kind: "set";
      ingredientSlug: IngredientSlug;
      location: KitchenLocation;
      optimisticStock: KitchenStock;
    }
  | {
      kind: "remove";
      ingredientSlug: IngredientSlug;
      optimisticStock: KitchenStock;
    }
  | {
      kind: "replace";
      optimisticStock: KitchenStock;
    }
  | {
      kind: "restore";
      stock: KitchenStock;
      optimisticStock: KitchenStock;
    }
  | {
      kind: "importLegacy";
      optimisticStock: KitchenStock;
    }
  | {
      kind: "discardLegacy";
      pantry: Pantry;
      optimisticStock: KitchenStock;
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
          return replacePantry(operation.optimisticStock);
        case "restore":
          return restorePantry(operation.stock);
        case "importLegacy":
          return importLegacyPantry(userId);
        case "discardLegacy":
          return Promise.resolve(discardLegacyPantry(operation.pantry));
      }
    },
    onMutate: async (operation) => {
      await queryClient.cancelQueries({ queryKey, exact: true });
      const previous = queryClient.getQueryData<Pantry>(queryKey);
      if (previous) {
        queryClient.setQueryData<Pantry>(queryKey, {
          ...previous,
          stock: operation.optimisticStock,
          pendingLegacyStock:
            operation.kind === "importLegacy" ||
            operation.kind === "discardLegacy"
              ? undefined
              : previous.pendingLegacyStock,
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

  function currentStock(): KitchenStock {
    return queryClient.getQueryData<Pantry>(queryKey)?.stock ?? EMPTY_STOCK;
  }

  return {
    clearStock() {
      mutation.mutate({ kind: "replace", optimisticStock: {} });
    },
    error: mutation.error,
    discardLegacyStock() {
      const pantry = queryClient.getQueryData<Pantry>(queryKey);
      if (!pantry?.pendingLegacyStock) return;
      mutation.mutate({
        kind: "discardLegacy",
        pantry,
        optimisticStock: pantry.stock,
      });
    },
    importLegacyStock() {
      const pantry = queryClient.getQueryData<Pantry>(queryKey);
      if (!pantry?.pendingLegacyStock) return;
      mutation.mutate({
        kind: "importLegacy",
        optimisticStock: pantry.pendingLegacyStock,
      });
    },
    isPending: mutation.isPending,
    removeFromStock(ingredientSlug: IngredientSlug) {
      const optimisticStock = { ...currentStock() };
      delete optimisticStock[ingredientSlug];
      mutation.mutate({ kind: "remove", ingredientSlug, optimisticStock });
    },
    replaceStock(stock: KitchenStock) {
      mutation.mutate({ kind: "replace", optimisticStock: { ...stock } });
    },
    restoreStock(stock: KitchenStock) {
      mutation.mutate({
        kind: "restore",
        stock: { ...stock },
        optimisticStock: { ...stock, ...currentStock() },
      });
    },
    setStockLocation(
      ingredientSlug: IngredientSlug,
      location: KitchenLocation,
    ) {
      mutation.mutate({
        kind: "set",
        ingredientSlug,
        location,
        optimisticStock: {
          ...currentStock(),
          [ingredientSlug]: location,
        },
      });
    },
  };
}
