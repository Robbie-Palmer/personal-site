"use client";

import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Pantry } from "@/lib/api/pantry";
import { authClient } from "@/lib/auth-client";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";
import {
  pantryRealtimeUrl,
  parsePantryRealtimeMessage,
} from "@/lib/realtime/pantry-realtime";

type ActiveHouseholdPantry = {
  userId: string;
  resourceId: string;
};

function activeHouseholdPantry(
  queryClient: QueryClient,
  userId: string | null,
): ActiveHouseholdPantry | null {
  if (!userId) return null;
  const query = queryClient.getQueryCache().find<Pantry>({
    queryKey: recipeQueryKeys.pantry(userId),
    exact: true,
  });
  const pantry = query?.state.data;
  return query &&
    query.getObserversCount() > 0 &&
    pantry?.scope.type === "household"
    ? { userId, resourceId: pantry.resourceId }
    : null;
}

function sameActivePantry(
  first: ActiveHouseholdPantry | null,
  second: ActiveHouseholdPantry | null,
): boolean {
  return (
    first?.userId === second?.userId && first?.resourceId === second?.resourceId
  );
}

export function PantryRealtimeBoundary() {
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? null;
  const [activePantry, setActivePantry] =
    useState<ActiveHouseholdPantry | null>(null);

  useEffect(() => {
    const update = () => {
      const next = activeHouseholdPantry(queryClient, userId);
      setActivePantry((current) =>
        sameActivePantry(current, next) ? current : next,
      );
    };
    update();
    return queryClient.getQueryCache().subscribe(update);
  }, [queryClient, userId]);

  useEffect(() => {
    if (!activePantry) return;

    const queryKey = recipeQueryKeys.pantry(activePantry.userId);
    let socket: WebSocket | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectAttempt = 0;
    let disposed = false;
    let recovery: Promise<void> | undefined;
    let requestedRevision: bigint | undefined;

    const cachedPantry = () => queryClient.getQueryData<Pantry>(queryKey);
    const recover = (minimumRevision?: bigint) => {
      if (
        minimumRevision !== undefined &&
        (requestedRevision === undefined || minimumRevision > requestedRevision)
      ) {
        requestedRevision = minimumRevision;
      }
      if (recovery) return;

      recovery = (async () => {
        // One fetch plus at most one follow-up covers an event that arrives
        // while the first canonical snapshot is in flight.
        for (let attempt = 0; attempt < 2; attempt += 1) {
          await queryClient.refetchQueries({ queryKey, exact: true });
          const pantry = cachedPantry();
          if (
            requestedRevision === undefined ||
            (pantry?.resourceId === activePantry.resourceId &&
              BigInt(pantry.revision) >= requestedRevision)
          ) {
            break;
          }
        }
      })()
        .catch(() => {
          // Focus, reconnect, and repair polling retain recovery responsibility.
        })
        .finally(() => {
          recovery = undefined;
          requestedRevision = undefined;
        });
    };

    const scheduleReconnect = () => {
      if (disposed || reconnectTimer || !navigator.onLine) return;
      const baseDelay = Math.min(1_000 * 2 ** reconnectAttempt, 30_000);
      const jitteredDelay = Math.round(baseDelay * (0.8 + Math.random() * 0.4));
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        connect();
      }, jitteredDelay);
    };

    const connect = () => {
      if (
        disposed ||
        !navigator.onLine ||
        socket?.readyState === WebSocket.OPEN ||
        socket?.readyState === WebSocket.CONNECTING
      ) {
        return;
      }
      socket = new WebSocket(pantryRealtimeUrl(window.location));
      socket.addEventListener("open", () => {
        reconnectAttempt = 0;
      });
      socket.addEventListener("message", (event) => {
        if (typeof event.data !== "string") return;
        const message = parsePantryRealtimeMessage(event.data);
        if (!message || message.resourceId !== activePantry.resourceId) return;
        if (message.type === "subscription.ready") {
          recover();
          return;
        }
        const pantry = cachedPantry();
        if (
          pantry?.resourceId === activePantry.resourceId &&
          BigInt(pantry.revision) >= BigInt(message.revision)
        ) {
          return;
        }
        recover(BigInt(message.revision));
      });
      socket.addEventListener("close", scheduleReconnect);
      socket.addEventListener("error", () => socket?.close());
    };

    const reconnectNow = () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
      if (
        socket?.readyState !== WebSocket.OPEN &&
        socket?.readyState !== WebSocket.CONNECTING
      ) {
        connect();
      }
      recover();
    };
    const recoverOnVisible = () => {
      if (document.visibilityState === "visible") reconnectNow();
    };

    window.addEventListener("online", reconnectNow);
    document.addEventListener("visibilitychange", recoverOnVisible);
    connect();
    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      window.removeEventListener("online", reconnectNow);
      document.removeEventListener("visibilitychange", recoverOnVisible);
      socket?.close(1_000, "Pantry subscription inactive");
    };
  }, [activePantry, queryClient]);

  return null;
}
