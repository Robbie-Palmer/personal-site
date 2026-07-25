import { queryOptions } from "@tanstack/react-query";
import { getPantryWithLegacyMigration } from "@/lib/api/pantry";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";

export const pantryQuery = (userId: string) =>
  queryOptions({
    queryKey: recipeQueryKeys.pantry(userId),
    queryFn: ({ signal }) => getPantryWithLegacyMigration(signal),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
