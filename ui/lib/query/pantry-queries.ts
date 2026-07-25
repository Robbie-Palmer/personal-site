import { queryOptions } from "@tanstack/react-query";
import { getPantry } from "@/lib/api/pantry";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";

export const pantryQuery = (userId: string) =>
  queryOptions({
    queryKey: recipeQueryKeys.pantry(userId),
    queryFn: ({ signal }) => getPantry(signal),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
