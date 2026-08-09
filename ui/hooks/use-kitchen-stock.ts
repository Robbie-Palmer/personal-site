"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { captureRecipeProductActivity } from "@/lib/analytics/recipe-product";
import {
  installPantrySnapshot,
  type Pantry,
  removePantryItem,
  replacePantry,
  restorePantry,
  setPantryItem,
} from "@/lib/api/pantry";
import { authClient } from "@/lib/auth-client";
import type { IngredientSlug } from "@/lib/domain/recipe/ingredient";
import type {
  KitchenLocation,
  KitchenStock,
} from "@/lib/domain/recipe/kitchen";
import { pantryQuery } from "@/lib/query/pantry-queries";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";

const EMPTY_STOCK: KitchenStock = {};

function stocksEqual(first: KitchenStock, second: KitchenStock): boolean {
  const firstEntries = Object.entries(first);
  return (
    firstEntries.length === Object.keys(second).length &&
    firstEntries.every(([slug, location]) => second[slug] === location)
  );
}

type PantryMutation =
  | {
      kind: "set";
      operationId: string;
      ingredientSlug: IngredientSlug;
      location: KitchenLocation;
    }
  | {
      kind: "remove";
      operationId: string;
      ingredientSlug: IngredientSlug;
    }
  | {
      kind: "replace";
      operationId: string;
      stock: KitchenStock;
    }
  | {
      kind: "restore";
      operationId: string;
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
          return setPantryItem(
            operation.ingredientSlug,
            operation.location,
            operation.operationId,
          );
        case "remove":
          return removePantryItem(
            operation.ingredientSlug,
            operation.operationId,
          );
        case "replace":
          return replacePantry(operation.stock, operation.operationId);
        case "restore":
          return restorePantry(operation.stock, operation.operationId);
      }
    },
    onMutate: async (operation) => {
      await queryClient.cancelQueries({ queryKey, exact: true });
      const previous = queryClient.getQueryData<Pantry>(queryKey);
      if (operation.kind === "set") {
        const stock = previous?.stock ?? EMPTY_STOCK;
        if (stock[operation.ingredientSlug] !== operation.location) {
          captureRecipeProductActivity("kitchen_ingredient_added", {
            ingredient_slug: operation.ingredientSlug,
            kitchen_location: operation.location,
            stocked_ingredient_count: Object.keys({
              ...stock,
              [operation.ingredientSlug]: operation.location,
            }).length,
          });
        }
      }
      let optimisticStock: KitchenStock | undefined;
      if (previous) {
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
          itemVersions:
            operation.kind === "remove"
              ? Object.fromEntries(
                  Object.entries(previous.itemVersions).filter(
                    ([ingredientSlug]) =>
                      ingredientSlug !== operation.ingredientSlug,
                  ),
                )
              : previous.itemVersions,
        });
      }
      return { optimisticStock, previous };
    },
    onError: (_error, _operation, context) => {
      const previous = context?.previous;
      const optimisticStock = context?.optimisticStock;
      if (previous) {
        queryClient.setQueryData<Pantry>(queryKey, (current) =>
          current &&
          (current.resourceId !== previous.resourceId ||
            current.revision !== previous.revision ||
            (optimisticStock && !stocksEqual(current.stock, optimisticStock)))
            ? current
            : previous,
        );
      }
    },
    onSuccess: (pantry) => {
      queryClient.setQueryData<Pantry>(queryKey, (current) =>
        installPantrySnapshot(current, pantry),
      );
    },
  });

  return {
    clearStock() {
      mutation.mutate({
        kind: "replace",
        operationId: crypto.randomUUID(),
        stock: {},
      });
    },
    error: mutation.error,
    isPending: mutation.isPending,
    removeFromStock(ingredientSlug: IngredientSlug) {
      mutation.mutate({
        kind: "remove",
        ingredientSlug,
        operationId: crypto.randomUUID(),
      });
    },
    replaceStock(stock: KitchenStock) {
      mutation.mutate({
        kind: "replace",
        operationId: crypto.randomUUID(),
        stock: { ...stock },
      });
    },
    restoreStock(stock: KitchenStock) {
      mutation.mutate({
        kind: "restore",
        operationId: crypto.randomUUID(),
        stock: { ...stock },
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
        operationId: crypto.randomUUID(),
      });
    },
  };
}
