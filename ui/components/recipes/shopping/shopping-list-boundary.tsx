"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { isApiError } from "@/lib/api/http";
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
  getShoppingListSnapshot,
  installShoppingListSnapshot,
  resetShoppingTripCompletion,
  type ShoppingListState,
  subscribeShoppingList,
} from "@/lib/shopping/shoppingListStore";

function shoppingListContents(): ShoppingListContents {
  const { recipes, checked, extras } = getShoppingListSnapshot();
  return { recipes, checked, extras };
}

function mergeLocalShoppingListChanges(
  baseline: ShoppingListContents,
  local: ShoppingListContents,
  remote: ShoppingListContents,
): ShoppingListContents {
  const baselineRecipes = new Map(
    baseline.recipes.map((recipe) => [recipe.slug, recipe]),
  );
  const localRecipes = new Map(
    local.recipes.map((recipe) => [recipe.slug, recipe]),
  );
  const recipes = new Map(
    remote.recipes.map((recipe) => [recipe.slug, recipe]),
  );
  for (const recipe of baseline.recipes) {
    if (!localRecipes.has(recipe.slug)) recipes.delete(recipe.slug);
  }
  for (const recipe of local.recipes) {
    if (
      JSON.stringify(recipe) !==
      JSON.stringify(baselineRecipes.get(recipe.slug))
    ) {
      recipes.set(recipe.slug, recipe);
    }
  }

  const checked = new Set(remote.checked);
  const localChecked = new Set(local.checked);
  for (const ingredient of baseline.checked) {
    if (!localChecked.has(ingredient)) checked.delete(ingredient);
  }
  const baselineChecked = new Set(baseline.checked);
  for (const ingredient of local.checked) {
    if (!baselineChecked.has(ingredient)) checked.add(ingredient);
  }

  const baselineExtras = new Map(
    baseline.extras.map((extra) => [extra.id, extra]),
  );
  const localExtras = new Map(local.extras.map((extra) => [extra.id, extra]));
  const extras = new Map(remote.extras.map((extra) => [extra.id, extra]));
  for (const extra of baseline.extras) {
    if (!localExtras.has(extra.id)) extras.delete(extra.id);
  }
  for (const extra of local.extras) {
    if (
      JSON.stringify(extra) !== JSON.stringify(baselineExtras.get(extra.id))
    ) {
      extras.set(extra.id, extra);
    }
  }

  return {
    recipes: [...recipes.values()],
    checked: [...checked],
    extras: [...extras.values()],
  };
}

function parseSavedSnapshot(serialized: string): ShoppingListContents {
  return JSON.parse(serialized) as ShoppingListContents;
}

const PLAN_RESOURCE_KEY = "recipe-shopping-plan-resource";
const pendingShoppingListSaves = new Map<string, Promise<void>>();

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
  const installedIdRef = useRef<string | undefined>(undefined);
  const savedSnapshot = useRef<string | undefined>(undefined);
  const savedRevision = useRef<string | undefined>(undefined);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    if (!current.data) return;
    const serialized = JSON.stringify(current.data.snapshot);
    const plan =
      localStorage.getItem(PLAN_RESOURCE_KEY) === current.data.resourceId
        ? getShoppingListSnapshot().plan
        : [];
    localStorage.setItem(PLAN_RESOURCE_KEY, current.data.resourceId);

    if (!installedId) {
      savedSnapshot.current = serialized;
      savedRevision.current = current.data.revision;
      installedIdRef.current = current.data.id;
      installShoppingListSnapshot(
        {
          ...current.data.snapshot,
          plan,
        },
        current.data.id,
      );
      setInstalledId(current.data.id);
      return;
    }
    if (
      current.data.id === installedId &&
      current.data.revision === savedRevision.current
    ) {
      return;
    }

    const local = shoppingListContents();
    const baseline = savedSnapshot.current;
    const hasLocalChanges =
      baseline !== undefined && JSON.stringify(local) !== baseline;
    const next =
      hasLocalChanges && baseline
        ? mergeLocalShoppingListChanges(
            parseSavedSnapshot(baseline),
            local,
            current.data.snapshot,
          )
        : current.data.snapshot;
    const hasRebasedChanges = JSON.stringify(next) !== serialized;
    savedSnapshot.current = serialized;
    savedRevision.current = current.data.revision;
    installedIdRef.current = current.data.id;
    installShoppingListSnapshot(
      {
        ...next,
        plan,
      },
      current.data.id,
      hasRebasedChanges ? "local" : "install",
    );
    setInstalledId(current.data.id);
  }, [current.data, installedId]);

  const hasInstalledList = Boolean(installedId);
  useEffect(() => {
    if (!hasInstalledList) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let syncTimer: ReturnType<typeof setTimeout> | undefined;
    let saving = Promise.resolve();
    const unsubscribe = subscribeShoppingList((source) => {
      if (source !== "local") {
        if (source === "install" && timer) {
          clearTimeout(timer);
          timer = undefined;
        }
        if (source === "storage") {
          if (syncTimer) clearTimeout(syncTimer);
          syncTimer = setTimeout(() => {
            void queryClient.invalidateQueries({
              queryKey: recipeQueryKeys.shoppingList(userId),
            });
          }, 500);
        }
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const snapshot = shoppingListContents();
        const serialized = JSON.stringify(snapshot);
        if (serialized === savedSnapshot.current) return;
        const listId = installedIdRef.current;
        if (!listId) return;
        saving = saving
          .catch(() => undefined)
          .then(async () => {
            if (installedIdRef.current !== listId || !savedRevision.current) {
              return;
            }
            const updated = await saveCurrentShoppingList(
              listId,
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
          .catch((error: unknown) => {
            setSaveFailed(true);
            if (isApiError(error) && error.status === 409) {
              void queryClient.invalidateQueries({
                queryKey: recipeQueryKeys.shoppingList(userId),
              });
            }
          });
        const pending = saving;
        pendingShoppingListSaves.set(listId, pending);
        void pending.then(() => {
          if (pendingShoppingListSaves.get(listId) === pending) {
            pendingShoppingListSaves.delete(listId);
          }
        });
      }, 250);
    });
    return () => {
      if (timer) clearTimeout(timer);
      if (syncTimer) clearTimeout(syncTimer);
      unsubscribe();
    };
  }, [hasInstalledList, queryClient, userId]);

  if (current.isError && !current.data) {
    return (
      <p className="rt-body p-8 text-center">
        Your shopping list could not be loaded.
      </p>
    );
  }
  if (!current.data || !installedId) {
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
    mutationFn: async ({
      current,
      previous,
    }: {
      current: StoredShoppingList;
      previous: ShoppingListState;
    }) => {
      await pendingShoppingListSaves.get(current.id);
      const latest =
        queryClient.getQueryData<StoredShoppingList>(queryKey) ?? current;
      if (latest.id !== current.id) {
        throw new Error("A new shopping list has already been started");
      }
      return startNewShoppingList(latest.id, latest.revision, {
        recipes: previous.recipes,
        checked: previous.checked,
        extras: previous.extras,
      });
    },
    onSuccess: (next) => {
      resetShoppingTripCompletion();
      queryClient.setQueryData<StoredShoppingList>(queryKey, next);
    },
    onError: async (_error, { current, previous }) => {
      try {
        const latest = await queryClient.fetchQuery({
          ...shoppingListQuery(userId),
          staleTime: 0,
        });
        if (latest.id !== current.id) return;
      } catch {
        // If reconciliation is also offline, restoring the browser copy is the
        // only non-destructive option. A later edit can retry persistence.
      }
      installShoppingListSnapshot(previous, current.id);
    },
  });
  const start = () => {
    const current = queryClient.getQueryData<StoredShoppingList>(queryKey);
    if (!current || mutation.isPending) return;
    const previous = getShoppingListSnapshot();

    // An install updates the screen immediately without scheduling an empty
    // PUT against the list that the POST is about to archive.
    installShoppingListSnapshot(
      { recipes: [], plan: [], checked: [], extras: [] },
      current.id,
      "install",
      false,
    );
    mutation.mutate({ current, previous });
  };

  return { ...mutation, start };
}
