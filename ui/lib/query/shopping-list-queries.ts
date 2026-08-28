import { queryOptions } from "@tanstack/react-query";
import { getCurrentShoppingList } from "@/lib/api/shopping-lists";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";

export const shoppingListQuery = (userId: string) =>
  queryOptions({
    queryKey: recipeQueryKeys.shoppingList(userId),
    queryFn: ({ signal }) => getCurrentShoppingList(signal),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
