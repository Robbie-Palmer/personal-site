import { queryOptions } from "@tanstack/react-query";
import {
  getPantry,
  installPantrySnapshot,
  type Pantry,
} from "@/lib/api/pantry";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";

export const pantryQuery = (userId: string) =>
  queryOptions({
    queryKey: recipeQueryKeys.pantry(userId),
    queryFn: ({ signal }) => getPantry(signal),
    structuralSharing: (current, incoming) =>
      installPantrySnapshot(current as Pantry | undefined, incoming as Pantry),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
