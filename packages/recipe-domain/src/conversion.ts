import type { Unit } from "./unit";

export type MeasurementSystem = "metric" | "us" | "uk";

export const MEASUREMENT_SYSTEM_LABELS: Record<MeasurementSystem, string> = {
  metric: "Metric",
  us: "US",
  uk: "UK",
};

type Dimension = "volume" | "weight";

type ConversionEntry = {
  /** Multiply amount by this to reach the base unit (ml for volume, g for weight). */
  toBase: number;
  dimension: Dimension;
};

// prettier-ignore
const CONVERSIONS: Partial<Record<Unit, ConversionEntry>> = {
  // Volume – base: ml
  ml:              { toBase: 1,          dimension: "volume" },
  l:               { toBase: 1000,       dimension: "volume" },
  tsp:             { toBase: 5,          dimension: "volume" }, // UK/metric standard (5 ml exactly)
  tbsp:            { toBase: 15,         dimension: "volume" }, // UK/metric standard (3 tsp)
  au_tbsp:         { toBase: 20,         dimension: "volume" }, // Australian tablespoon
  us_cup:          { toBase: 236.588,    dimension: "volume" },
  uk_cup:          { toBase: 250,        dimension: "volume" },
  au_cup:          { toBase: 250,        dimension: "volume" },
  uk_imperial_cup: { toBase: 284.131,    dimension: "volume" },
  uk_pint:         { toBase: 568.261,    dimension: "volume" },
  us_pint:         { toBase: 473.176,    dimension: "volume" },
  us_fl_oz:        { toBase: 29.5735,    dimension: "volume" },
  uk_fl_oz:        { toBase: 28.4131,    dimension: "volume" },
  // Weight – base: g
  g:               { toBase: 1,          dimension: "weight" },
  kg:              { toBase: 1000,       dimension: "weight" },
  oz:              { toBase: 28.3495,    dimension: "weight" },
  lb:              { toBase: 453.592,    dimension: "weight" },
};

/**
 * Convert `amount` of `from` units to `to` units.
 * Returns null if the units are not compatible (different physical dimensions
 * or either unit is not in the conversion table).
 */
export function convertUnit(
  amount: number,
  from: Unit,
  to: Unit,
): number | null {
  const fromEntry = CONVERSIONS[from];
  const toEntry = CONVERSIONS[to];
  if (!fromEntry || !toEntry || fromEntry.dimension !== toEntry.dimension)
    return null;
  return (amount * fromEntry.toBase) / toEntry.toBase;
}

/** Returns the physical dimension for a unit, or null for non-convertible units. */
export function getUnitDimension(unit: Unit): Dimension | null {
  return CONVERSIONS[unit]?.dimension ?? null;
}

// ---------------------------------------------------------------------------
// Preferred display unit selection per system
// ---------------------------------------------------------------------------

// Volume thresholds (in ml) for selecting the display unit in each system.
// The goal is a human-readable amount (e.g. "1 cup" rather than "237 ml").
function preferredVolumeUnit(ml: number, system: MeasurementSystem): Unit {
  switch (system) {
    case "metric":
      return ml >= 1000 ? "l" : "ml";

    case "us":
      // < ~1.5 tsp → tsp; < 4 tbsp → tbsp; < ~2 US cups → cup; else pint
      if (ml < 7.5) return "tsp";
      if (ml < 60) return "tbsp";
      if (ml < 473) return "us_cup";
      return "us_pint";

    case "uk":
      // UK cooking is metric for small/large volumes; pint for the middle band
      if (ml < 15) return "tsp";
      if (ml < 60) return "tbsp";
      if (ml < 300) return "ml";
      if (ml < 1200) return "uk_pint";
      return "l";
  }
}

function preferredWeightUnit(g: number, system: MeasurementSystem): Unit {
  switch (system) {
    case "metric":
    case "uk":
      return g >= 1000 ? "kg" : "g";

    case "us":
      return g >= 453.592 ? "lb" : "oz";
  }
}

/**
 * Convert `amount` of `unit` to the most appropriate display unit for
 * `system`. Returns null for non-convertible units (countable, approximate).
 */
export function convertToSystem(
  amount: number,
  unit: Unit,
  system: MeasurementSystem,
): { amount: number; unit: Unit } | null {
  const entry = CONVERSIONS[unit];
  if (!entry) return null;

  const baseAmount = amount * entry.toBase;
  const targetUnit =
    entry.dimension === "volume"
      ? preferredVolumeUnit(baseAmount, system)
      : preferredWeightUnit(baseAmount, system);

  const targetEntry = CONVERSIONS[targetUnit];
  if (!targetEntry) return null;

  return { amount: baseAmount / targetEntry.toBase, unit: targetUnit };
}
