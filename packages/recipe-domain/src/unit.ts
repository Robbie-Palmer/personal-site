import { z } from "zod";

export const UnitSchema = z.enum([
  // Weight
  "g",
  "kg",
  "oz",
  // Volume
  "ml",
  "l",
  "pint",
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
  "sachet",
  "bag",
]);

export type Unit = z.infer<typeof UnitSchema>;

export type UnitLabel = {
  singular: string;
  plural: string;
  /** When true, no space between number and label (e.g. "400g" not "400 g") */
  noSpace?: boolean;
};

export const UNIT_LABELS: Record<Unit, UnitLabel> = {
  g: { singular: "g", plural: "g", noSpace: true },
  kg: { singular: "kg", plural: "kg", noSpace: true },
  oz: { singular: "oz", plural: "oz" },
  ml: { singular: "ml", plural: "ml", noSpace: true },
  l: { singular: "l", plural: "l", noSpace: true },
  pint: { singular: "pint", plural: "pints" },
  tsp: { singular: "tsp", plural: "tsp" },
  tbsp: { singular: "tbsp", plural: "tbsp" },
  cup: { singular: "cup", plural: "cups" },
  pinch: { singular: "pinch", plural: "pinches" },
  handful: { singular: "handful", plural: "handfuls" },
  piece: { singular: "piece", plural: "pieces" },
  slice: { singular: "slice", plural: "slices" },
  clove: { singular: "clove", plural: "cloves" },
  tin: { singular: "tin", plural: "tins" },
  cube: { singular: "cube", plural: "cubes" },
  sachet: { singular: "sachet", plural: "sachets" },
  bag: { singular: "bag", plural: "bags" },
};

const EXPLICIT_UNIT_ALIASES: Partial<Record<string, Unit>> = {
  c: "cup",
  gram: "g",
  grams: "g",
  kilogram: "kg",
  kilograms: "kg",
  millilitre: "ml",
  millilitres: "ml",
  milliliter: "ml",
  milliliters: "ml",
  litre: "l",
  litres: "l",
  liter: "l",
  liters: "l",
  ounce: "oz",
  ounces: "oz",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  can: "tin",
  cans: "tin",
  pk: "piece",
  pack: "piece",
  packs: "piece",
};

const NORMALIZED_UNIT_ALIASES: Record<string, Unit> = (() => {
  const aliases: Record<string, Unit> = { ...EXPLICIT_UNIT_ALIASES } as Record<
    string,
    Unit
  >;

  for (const [unit, labels] of Object.entries(UNIT_LABELS) as Array<
    [Unit, UnitLabel]
  >) {
    aliases[unit] = unit;
    aliases[labels.singular.toLowerCase()] = unit;
    aliases[labels.plural.toLowerCase()] = unit;
  }

  return aliases;
})();

export function normalizeUnitToken(token: string | undefined): Unit | undefined {
  if (!token) return undefined;
  const normalized = token.trim().toLowerCase();
  if (!normalized) return undefined;
  return NORMALIZED_UNIT_ALIASES[normalized];
}

export type UnitCategory = "weight" | "volume" | "spoon" | "discrete";

export const UNIT_CATEGORIES: Record<Unit, UnitCategory> = {
  g: "weight",
  kg: "weight",
  oz: "weight",
  ml: "volume",
  l: "volume",
  pint: "volume",
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
  sachet: "discrete",
  bag: "discrete",
};
