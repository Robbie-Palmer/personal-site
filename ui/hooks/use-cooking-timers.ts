"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  type CookingTimer,
  getServerTimersSnapshot,
  getTimersSnapshot,
  subscribeTimers,
} from "@/lib/cooking/timerStore";

/**
 * All cooking timers, shared app-wide. Re-renders every second while any
 * timer is running (the store rebuilds the snapshot on each tick).
 */
export function useCookingTimers(): readonly CookingTimer[] {
  return useSyncExternalStore(
    subscribeTimers,
    getTimersSnapshot,
    getServerTimersSnapshot,
  );
}

/**
 * A single timer by id. Subscribes with a per-id selector so a component only
 * re-renders when *its* timer changes — the store keeps a stable object
 * identity for timers whose remaining second didn't change on a tick, so idle
 * pills don't re-render four times a second alongside the one counting down.
 */
export function useCookingTimer(id: string): CookingTimer | undefined {
  const getSnapshot = useCallback(
    () => getTimersSnapshot().find((t) => t.id === id),
    [id],
  );
  return useSyncExternalStore(subscribeTimers, getSnapshot, () => undefined);
}
