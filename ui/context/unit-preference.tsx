"use client";

import { createContext, useCallback, useEffect, useState } from "react";
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
  return "metric";
}

type ContextValue = [MeasurementSystem, (system: MeasurementSystem) => void];

export const UnitPreferenceContext = createContext<ContextValue | null>(null);

export function UnitPreferenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [system, setSystemState] = useState<MeasurementSystem>("metric");

  useEffect(() => {
    setSystemState(readStored());

    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue && VALID_SYSTEMS.has(e.newValue)) {
        setSystemState(e.newValue as MeasurementSystem);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setSystem = useCallback((next: MeasurementSystem) => {
    setSystemState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore write failures
    }
  }, []);

  return (
    <UnitPreferenceContext.Provider value={[system, setSystem]}>
      {children}
    </UnitPreferenceContext.Provider>
  );
}
