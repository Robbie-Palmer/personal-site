"use client";

import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  clearPrivateRecipeQueries,
  createRecipeQueryClient,
} from "@/lib/query/recipe-query-client";

const RecipeQueryDevtools =
  process.env.NODE_ENV === "development"
    ? dynamic(
        () =>
          import("@tanstack/react-query-devtools").then(
            (module) => module.ReactQueryDevtools,
          ),
        { ssr: false },
      )
    : null;

export function RecipeAccountCacheBoundary() {
  const { data: session, isPending } = authClient.useSession();
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (isPending) return;

    const previous = previousUserId.current;
    previousUserId.current = userId;
    if (previous === undefined || previous === null || previous === userId) {
      return;
    }

    void clearPrivateRecipeQueries(queryClient, previous);
  }, [isPending, queryClient, userId]);

  return null;
}

export function RecipeQueryProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(createRecipeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <RecipeAccountCacheBoundary />
      {children}
      {RecipeQueryDevtools ? (
        <RecipeQueryDevtools initialIsOpen={false} />
      ) : null}
    </QueryClientProvider>
  );
}
