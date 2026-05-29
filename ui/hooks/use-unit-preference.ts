"use client";

import { useCallback, useEffect, useState } from "react";
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

export function useUnitPreference(): [
  MeasurementSystem,
  (system: MeasurementSystem) => void,
] {
  const [system, setSystemState] = useState<MeasurementSystem>("metric");

  useEffect(() => {
    setSystemState(readStored());
  }, []);

  const setSystem = useCallback((next: MeasurementSystem) => {
    setSystemState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore write failures
    }
  }, []);

  return [system, setSystem];
}
