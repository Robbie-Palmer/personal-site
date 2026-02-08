import { z } from "zod";

export const UnitSchema = z.enum([
  // Weight
  "g",
  "kg",
  // Volume
  "ml",
  "l",
  // Spoon measures
  "tsp",
  "tbsp",
  // Cooking measures
  "cup",
  "pinch",
  "handful",
  // Discrete
  "piece",
  "slice",
  "clove",
  "tin",
  "cube",
]);

export type Unit = z.infer<typeof UnitSchema>;

export type UnitLabel = {
  singular: string;
  plural: string;
  /** Word inserted between the unit and ingredient name, e.g. "of" → "3 cloves of garlic" */
  connector?: string;
};

export const UNIT_LABELS: Record<Unit, UnitLabel> = {
  g: { singular: "g", plural: "g" },
  kg: { singular: "kg", plural: "kg" },
  ml: { singular: "ml", plural: "ml" },
  l: { singular: "l", plural: "l" },
  tsp: { singular: "tsp", plural: "tsp" },
  tbsp: { singular: "tbsp", plural: "tbsp" },
  cup: { singular: "cup", plural: "cups", connector: "of" },
  pinch: { singular: "pinch", plural: "pinches", connector: "of" },
  handful: { singular: "handful", plural: "handfuls", connector: "of" },
  piece: { singular: "piece", plural: "pieces", connector: "of" },
  slice: { singular: "slice", plural: "slices", connector: "of" },
  clove: { singular: "clove", plural: "cloves", connector: "of" },
  tin: { singular: "tin", plural: "tins", connector: "of" },
  cube: { singular: "cube", plural: "cubes", connector: "of" },
};

export type UnitCategory = "weight" | "volume" | "spoon" | "discrete";

export const UNIT_CATEGORIES: Record<Unit, UnitCategory> = {
  g: "weight",
  kg: "weight",
  ml: "volume",
  l: "volume",
  tsp: "spoon",
  tbsp: "spoon",
  cup: "volume",
  pinch: "discrete",
  handful: "discrete",
  piece: "discrete",
  slice: "discrete",
  clove: "discrete",
  tin: "discrete",
  cube: "discrete",
};

// Conversion factors to base unit within each category
// Weight base: g, Volume base: ml, Spoon base: tsp
export const UNIT_CONVERSIONS: Partial<
  Record<Unit, { baseUnit: Unit; factor: number }>
> = {
  g: { baseUnit: "g", factor: 1 },
  kg: { baseUnit: "g", factor: 1000 },
  ml: { baseUnit: "ml", factor: 1 },
  l: { baseUnit: "ml", factor: 1000 },
  tsp: { baseUnit: "tsp", factor: 1 },
  tbsp: { baseUnit: "tsp", factor: 3 },
  cup: { baseUnit: "ml", factor: 250 },
};
