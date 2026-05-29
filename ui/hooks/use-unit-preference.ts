"use client";

import { useContext } from "react";
import { UnitPreferenceContext } from "@/context/unit-preference";
import type { MeasurementSystem } from "@/lib/domain/recipe/unit";

export function useUnitPreference(): [
  MeasurementSystem,
  (system: MeasurementSystem) => void,
] {
  const ctx = useContext(UnitPreferenceContext);
  if (!ctx)
    throw new Error(
      "useUnitPreference must be used inside <UnitPreferenceProvider>",
    );
  return ctx;
}
