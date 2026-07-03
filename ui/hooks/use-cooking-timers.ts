"use client";

import { useSyncExternalStore } from "react";
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

export function useCookingTimer(id: string): CookingTimer | undefined {
  return useCookingTimers().find((t) => t.id === id);
}
