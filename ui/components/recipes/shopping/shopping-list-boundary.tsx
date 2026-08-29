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

const PLAN_RESOURCE_KEY = "recipe-shopping-plan-resource";

export function ShoppingListBoundary({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id ?? "pending";
  const queryClient = useQueryClient();
  const current = useQuery({
    ...shoppingListQuery(userId),
    enabled: Boolean(session),
  });
  const [installedId, setInstalledId] = useState<string>();
  const savedSnapshot = useRef<string | undefined>(undefined);
  const savedRevision = useRef<string | undefined>(undefined);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    if (!current.data || current.data.id === installedId) return;
    const serialized = JSON.stringify(current.data.snapshot);
    savedSnapshot.current = serialized;
    savedRevision.current = current.data.revision;
    const plan =
      localStorage.getItem(PLAN_RESOURCE_KEY) === current.data.resourceId
        ? getShoppingListSnapshot().plan
        : [];
    localStorage.setItem(PLAN_RESOURCE_KEY, current.data.resourceId);
    installShoppingListSnapshot(
      {
        ...current.data.snapshot,
        plan,
      },
      current.data.id,
    );
    setInstalledId(current.data.id);
  }, [current.data, installedId]);

  useEffect(() => {
    if (!installedId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let saving = Promise.resolve();
    const unsubscribe = subscribeShoppingList((source) => {
      if (source !== "local") return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const snapshot = shoppingListContents();
        const serialized = JSON.stringify(snapshot);
        if (serialized === savedSnapshot.current) return;
        saving = saving
          .catch(() => undefined)
          .then(async () => {
            if (!savedRevision.current) return;
            const updated = await saveCurrentShoppingList(
              installedId,
              savedRevision.current,
              snapshot,
            );
            savedSnapshot.current = serialized;
            savedRevision.current = updated.revision;
            queryClient.setQueryData<StoredShoppingList>(
              recipeQueryKeys.shoppingList(userId),
              updated,
            );
            setSaveFailed(false);
          })
          .catch(() => {
            setSaveFailed(true);
          });
      }, 250);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [installedId, queryClient, userId]);

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
  return (
    <>
      {saveFailed ? (
        <p className="rt-body bg-[var(--cream-dark)] px-4 py-2 text-center">
          Your latest shopping-list changes have not been saved. They remain on
          this device; edit the list to try again.
        </p>
      ) : null}
      {children}
    </>
  );
}

export function useStartNewShoppingList() {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id ?? "pending";
  const queryClient = useQueryClient();
  const queryKey = recipeQueryKeys.shoppingList(userId);
  const mutation = useMutation({
    mutationFn: () => {
      const current = queryClient.getQueryData<StoredShoppingList>(queryKey);
      if (!current) throw new Error("Shopping list has not loaded");
      return startNewShoppingList(
        current.id,
        current.revision,
        shoppingListContents(),
      );
    },
    onSuccess: (next) => {
      clearList();
      queryClient.setQueryData<StoredShoppingList>(queryKey, next);
    },
  });
  return mutation;
}
