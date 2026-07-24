import { infiniteQueryOptions } from "@tanstack/react-query";
import { getDiscoverFeedPage } from "@/lib/api/discover-feed";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";

const FEED_STALE_TIME = 5 * 60_000;

export const publicDiscoverFeedQuery = () =>
  infiniteQueryOptions({
    queryKey: recipeQueryKeys.publicDiscoverFeed(),
    queryFn: ({ pageParam, signal }) =>
      getDiscoverFeedPage("public", pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: FEED_STALE_TIME,
    refetchOnWindowFocus: true,
  });

export const householdDiscoverFeedQuery = (userId: string) =>
  infiniteQueryOptions({
    queryKey: recipeQueryKeys.householdDiscoverFeed(userId),
    queryFn: ({ pageParam, signal }) =>
      getDiscoverFeedPage("household", pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: FEED_STALE_TIME,
    refetchOnWindowFocus: true,
  });
