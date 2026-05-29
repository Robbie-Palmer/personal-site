"use client";

import { useSyncExternalStore } from "react";
import type { MeasurementSystem } from "@/lib/domain/recipe/unit";

const STORAGE_KEY = "recipe-unit-preference";
const VALID_SYSTEMS = new Set<string>(["metric", "us", "uk"]);

function readStored(): MeasurementSystem {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && VALID_SYSTEMS.has(v)) return v as MeasurementSystem;
  } catch {
    // localStorage unavailable (SSR, private browsing, etc.)
  }
  return "uk";
}

// Module-level listener set so every hook instance shares one store.
const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  // storage fires for changes in other tabs
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function setSystem(next: MeasurementSystem): void {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore write failures
  }
  for (const listener of listeners) listener();
}

export function useUnitPreference(): [
  MeasurementSystem,
  (system: MeasurementSystem) => void,
] {
  const system = useSyncExternalStore(
    subscribe,
    readStored,
    // getServerSnapshot – must match initial SSR output to avoid hydration mismatch
    () => "uk" as MeasurementSystem,
  );

  return [system, setSystem];
}
