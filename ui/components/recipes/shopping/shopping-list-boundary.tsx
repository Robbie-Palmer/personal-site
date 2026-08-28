"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  type ShoppingListContents,
  type StoredShoppingList,
  saveCurrentShoppingList,
  startNewShoppingList,
} from "@/lib/api/shopping-lists";
import { authClient } from "@/lib/auth-client";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";
import { shoppingListQuery } from "@/lib/query/shopping-list-queries";
import {
  clearList,
  getShoppingListSnapshot,
  installShoppingListSnapshot,
  subscribeShoppingList,
} from "@/lib/shopping/shoppingListStore";

function shoppingListContents(): ShoppingListContents {
  const { recipes, checked, extras } = getShoppingListSnapshot();
  return { recipes, checked, extras };
}

export function ShoppingListBoundary({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id ?? "pending";
  const current = useQuery({
    ...shoppingListQuery(userId),
    enabled: Boolean(session),
  });
  const [installedId, setInstalledId] = useState<string>();
  const savedSnapshot = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!current.data) return;
    const serialized = JSON.stringify(current.data.snapshot);
    savedSnapshot.current = serialized;
    installShoppingListSnapshot({
      ...current.data.snapshot,
      plan: getShoppingListSnapshot().plan,
    });
    setInstalledId(current.data.id);
  }, [current.data]);

  useEffect(() => {
    if (!installedId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let saving = Promise.resolve();
    const unsubscribe = subscribeShoppingList(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const snapshot = shoppingListContents();
        const serialized = JSON.stringify(snapshot);
        if (serialized === savedSnapshot.current) return;
        saving = saving
          .catch(() => undefined)
          .then(async () => {
            await saveCurrentShoppingList(snapshot);
            savedSnapshot.current = serialized;
          });
      }, 250);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [installedId]);

  if (current.isError && !current.data) {
    return (
      <p className="rt-body p-8 text-center">
        Your shopping list could not be loaded.
      </p>
    );
  }
  if (!current.data || installedId !== current.data.id) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-[var(--terracotta)]" />
      </div>
    );
  }
  return children;
}

export function useStartNewShoppingList() {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id ?? "pending";
  const queryClient = useQueryClient();
  const queryKey = recipeQueryKeys.shoppingList(userId);
  const mutation = useMutation({
    mutationFn: () => startNewShoppingList(shoppingListContents()),
    onSuccess: (next) => {
      clearList();
      queryClient.setQueryData<StoredShoppingList>(queryKey, next);
    },
  });
  return mutation;
}
