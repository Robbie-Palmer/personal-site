import { QueryClient, type QueryKey } from "@tanstack/react-query";
import { isApiError } from "@/lib/api/http";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";

const MAX_TRANSIENT_FAILURES = 2;

export function shouldRetryRecipeRequest(
  failureCount: number,
  error: unknown,
): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return false;
  }
  if (isApiError(error)) {
    return error.status >= 500 && failureCount < MAX_TRANSIENT_FAILURES;
  }
  return error instanceof TypeError && failureCount < MAX_TRANSIENT_FAILURES;
}

export function createRecipeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        retry: shouldRetryRecipeRequest,
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4_000),
        staleTime: 2 * 60_000,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function startsWith(queryKey: QueryKey, prefix: QueryKey): boolean {
  return prefix.every((part, index) => queryKey[index] === part);
}

export async function clearPrivateRecipeQueries(
  queryClient: QueryClient,
  userId?: string,
): Promise<void> {
  const prefix = userId
    ? recipeQueryKeys.user(userId)
    : recipeQueryKeys.private();
  const predicate = (query: { queryKey: QueryKey }) =>
    startsWith(query.queryKey, prefix);

  try {
    await queryClient.cancelQueries({ predicate });
  } catch {
    // Removal is the safety boundary; cancellation is only best-effort.
  }
  queryClient.removeQueries({ predicate });
}

export async function clearOtherPrivateRecipeQueries(
  queryClient: QueryClient,
  currentUserId: string | null,
  isCurrentAccount: () => boolean = () => true,
): Promise<void> {
  const privatePrefix = recipeQueryKeys.private();
  const currentUserPrefix = currentUserId
    ? recipeQueryKeys.user(currentUserId)
    : null;
  const predicate = (query: { queryKey: QueryKey }) =>
    startsWith(query.queryKey, privatePrefix) &&
    (!currentUserPrefix || !startsWith(query.queryKey, currentUserPrefix));

  try {
    await queryClient.cancelQueries({ predicate });
  } catch {
    // A failed cancellation must not prevent cache isolation.
  }
  if (isCurrentAccount()) queryClient.removeQueries({ predicate });
}
