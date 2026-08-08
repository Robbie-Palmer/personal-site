import { queryOptions } from "@tanstack/react-query";
import {
  getCookFollowStatus,
  getOwnCookConnections,
  getPublicCook,
  getPublicCooks,
} from "@/lib/api/public-cooks";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";

const PUBLIC_COOKS_STALE_TIME = 5 * 60_000;

export const publicCooksQuery = () =>
  queryOptions({
    queryKey: recipeQueryKeys.publicCooks(),
    queryFn: ({ signal }) => getPublicCooks(signal),
    staleTime: PUBLIC_COOKS_STALE_TIME,
    refetchOnWindowFocus: true,
  });

export const publicCookQuery = (cookId: string) =>
  queryOptions({
    queryKey: recipeQueryKeys.publicCook(cookId),
    queryFn: ({ signal }) => getPublicCook(cookId, signal),
    staleTime: PUBLIC_COOKS_STALE_TIME,
    refetchOnWindowFocus: true,
  });

export const cookFollowStatusQuery = (userId: string, cookId: string) =>
  queryOptions({
    queryKey: recipeQueryKeys.cookFollowStatus(userId, cookId),
    queryFn: ({ signal }) => getCookFollowStatus(cookId, signal),
    staleTime: PUBLIC_COOKS_STALE_TIME,
    refetchOnWindowFocus: true,
  });

export const ownCookConnectionsQuery = (userId: string) =>
  queryOptions({
    queryKey: recipeQueryKeys.cookConnections(userId),
    queryFn: ({ signal }) => getOwnCookConnections(signal),
    staleTime: PUBLIC_COOKS_STALE_TIME,
    refetchOnWindowFocus: true,
  });
