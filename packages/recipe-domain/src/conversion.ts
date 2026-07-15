import type { Unit } from "./unit";

export type MeasurementSystem = "metric" | "us" | "uk";
export type MeasurementPreset = MeasurementSystem | "custom";
export type MeasurementDimension = "volume" | "weight";

export type UnitTier = {
  unit: Unit;
  /** Exclusive upper bound in the dimension's base unit (ml or g). */
  upTo: number;
};

export type UnitPreference = {
  preset: MeasurementPreset;
  weight: UnitTier[];
  volume: UnitTier[];
};

export type MeasurementPreference = MeasurementSystem | UnitPreference;

export const MEASUREMENT_SYSTEM_LABELS: Record<MeasurementSystem, string> = {
  metric: "Metric",
  us: "US",
  uk: "UK",
};

type ConversionEntry = {
  /** Multiply amount by this to reach the base unit (ml for volume, g for weight). */
  toBase: number;
  dimension: MeasurementDimension;
};

// prettier-ignore
const CONVERSIONS: Partial<Record<Unit, ConversionEntry>> = {
  ml:              { toBase: 1,          dimension: "volume" },
  l:               { toBase: 1000,       dimension: "volume" },
  tsp:             { toBase: 5,          dimension: "volume" },
  tbsp:            { toBase: 15,         dimension: "volume" },
  au_tbsp:         { toBase: 20,         dimension: "volume" },
  us_cup:          { toBase: 236.588,    dimension: "volume" },
  uk_cup:          { toBase: 250,        dimension: "volume" },
  au_cup:          { toBase: 250,        dimension: "volume" },
  uk_imperial_cup: { toBase: 284.131,    dimension: "volume" },
  uk_pint:         { toBase: 568.261,    dimension: "volume" },
  us_pint:         { toBase: 473.176,    dimension: "volume" },
  us_fl_oz:        { toBase: 29.5735,    dimension: "volume" },
  uk_fl_oz:        { toBase: 28.4131,    dimension: "volume" },
  g:               { toBase: 1,          dimension: "weight" },
  kg:              { toBase: 1000,       dimension: "weight" },
  oz:              { toBase: 28.3495,    dimension: "weight" },
  lb:              { toBase: 453.592,    dimension: "weight" },
};

const PRESET_LADDERS: Record<MeasurementSystem, Omit<UnitPreference, "preset">> = {
  metric: {
    weight: [{ unit: "g", upTo: 1000 }, { unit: "kg", upTo: Infinity }],
    volume: [
      { unit: "tsp", upTo: 15 },
      { unit: "tbsp", upTo: 45 },
      { unit: "ml", upTo: 1000 },
      { unit: "l", upTo: Infinity },
    ],
  },
  uk: {
    weight: [{ unit: "g", upTo: 1000 }, { unit: "kg", upTo: Infinity }],
    volume: [
      { unit: "tsp", upTo: 15 },
      { unit: "tbsp", upTo: 60 },
      { unit: "ml", upTo: 300 },
      { unit: "uk_pint", upTo: 1200 },
      { unit: "l", upTo: Infinity },
    ],
  },
  us: {
    weight: [{ unit: "oz", upTo: 453.592 }, { unit: "lb", upTo: Infinity }],
    volume: [
      { unit: "tsp", upTo: 15 },
      { unit: "tbsp", upTo: 60 },
      { unit: "us_cup", upTo: 473.176 },
      { unit: "us_pint", upTo: Infinity },
    ],
  },
};

function copyTiers(tiers: UnitTier[]): UnitTier[] {
  return tiers.map((tier) => ({ ...tier }));
}

export function preferenceForSystem(system: MeasurementSystem): UnitPreference {
  const preset = PRESET_LADDERS[system];
  return {
    preset: system,
    weight: copyTiers(preset.weight),
    volume: copyTiers(preset.volume),
  };
}

export function convertUnit(amount: number, from: Unit, to: Unit): number | null {
  const fromEntry = CONVERSIONS[from];
  const toEntry = CONVERSIONS[to];
  if (!fromEntry || !toEntry || fromEntry.dimension !== toEntry.dimension)
    return null;
  return (amount * fromEntry.toBase) / toEntry.toBase;
}

export function getUnitDimension(unit: Unit): MeasurementDimension | null {
  return CONVERSIONS[unit]?.dimension ?? null;
}

function preferenceFrom(value: MeasurementPreference): UnitPreference {
  return typeof value === "string" ? preferenceForSystem(value) : value;
}

/**
 * Convert an amount to the first preferred tier whose base-unit threshold has
 * not been reached. The last tier is always the catch-all.
 */
export function convertToSystem(
  amount: number,
  unit: Unit,
  preference: MeasurementPreference,
): { amount: number; unit: Unit } | null {
  const entry = CONVERSIONS[unit];
  if (!entry) return null;

  const baseAmount = amount * entry.toBase;
  const tiers = preferenceFrom(preference)[entry.dimension];
  const target = tiers.find((tier) => baseAmount < tier.upTo) ?? tiers.at(-1);
  if (!target) return null;

  const targetEntry = CONVERSIONS[target.unit];
  if (targetEntry?.dimension !== entry.dimension) return null;
  return { amount: baseAmount / targetEntry.toBase, unit: target.unit };
}
