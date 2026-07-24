"use client";

import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  clearOtherPrivateRecipeQueries,
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

let browserQueryClient: ReturnType<typeof createRecipeQueryClient> | undefined;

function getRecipeQueryClient() {
  if (typeof window === "undefined") return createRecipeQueryClient();
  browserQueryClient ??= createRecipeQueryClient();
  return browserQueryClient;
}

export function RecipeAccountCacheBoundary() {
  const { data: session, isPending } = authClient.useSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? null;
  const activeAccount = useRef({ isPending, userId });
  activeAccount.current = { isPending, userId };

  useEffect(() => {
    if (isPending) return;
    void clearOtherPrivateRecipeQueries(queryClient, userId, () => {
      return (
        !activeAccount.current.isPending &&
        activeAccount.current.userId === userId
      );
    }).catch(() => {
      // Cache removal is best-effort; the active account guard prevents leaks.
    });
  }, [isPending, queryClient, userId]);

  return null;
}

export function RecipeQueryProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(getRecipeQueryClient);

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
