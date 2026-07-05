import { z } from "zod";

export const UnitSchema = z.enum([
  // Weight
  "g",
  "kg",
  "oz",
  "lb",
  // Volume – metric
  "ml",
  "l",
  // Volume – spoon measures
  "tsp",
  "tbsp",
  "au_tbsp",
  // Volume – cups (each standard is a distinct unit)
  "us_cup",          // US customary cup – 236.588 ml
  "uk_cup",          // UK metric cup – 250 ml
  "au_cup",          // Australian cup – 250 ml
  "uk_imperial_cup", // Old British Imperial cup – 284.131 ml
  // Volume – pints (UK and US are ~20% different)
  "uk_pint",         // UK Imperial pint – 568.261 ml
  "us_pint",         // US liquid pint – 473.176 ml
  // Volume – fluid ounces
  "us_fl_oz",        // US fluid ounce – 29.5735 ml
  "uk_fl_oz",        // UK fluid ounce – 28.4131 ml
  // Cooking approximates (non-convertible)
  "pinch",
  "handful",
  // Discrete / countable
  "piece",
  "slice",
  "clove",
  "tin",
  "cube",
  "sachet",
  "bag",
  "bunch",
]);

export type Unit = z.infer<typeof UnitSchema>;

export type UnitLabel = {
  singular: string;
  plural: string;
  /** When true, no space between number and label (e.g. "400g" not "400 g") */
  noSpace?: boolean;
};

export const UNIT_LABELS: Record<Unit, UnitLabel> = {
  g:               { singular: "g",       plural: "g",        noSpace: true },
  kg:              { singular: "kg",      plural: "kg",       noSpace: true },
  oz:              { singular: "oz",      plural: "oz" },
  lb:              { singular: "lb",      plural: "lbs" },
  ml:              { singular: "ml",      plural: "ml",       noSpace: true },
  l:               { singular: "l",       plural: "l",        noSpace: true },
  tsp:             { singular: "tsp",     plural: "tsp" },
  tbsp:            { singular: "tbsp",    plural: "tbsp" },
  au_tbsp:         { singular: "tbsp",    plural: "tbsp" },
  us_cup:          { singular: "cup",     plural: "cups" },
  uk_cup:          { singular: "cup",     plural: "cups" },
  au_cup:          { singular: "cup",     plural: "cups" },
  uk_imperial_cup: { singular: "cup",     plural: "cups" },
  uk_pint:         { singular: "pint",    plural: "pints" },
  us_pint:         { singular: "pint",    plural: "pints" },
  us_fl_oz:        { singular: "fl oz",   plural: "fl oz" },
  uk_fl_oz:        { singular: "fl oz",   plural: "fl oz" },
  pinch:           { singular: "pinch",   plural: "pinches" },
  handful:         { singular: "handful", plural: "handfuls" },
  piece:           { singular: "piece",   plural: "pieces" },
  slice:           { singular: "slice",   plural: "slices" },
  clove:           { singular: "clove",   plural: "cloves" },
  tin:             { singular: "tin",     plural: "tins" },
  cube:            { singular: "cube",    plural: "cubes" },
  sachet:          { singular: "sachet",  plural: "sachets" },
  bag:             { singular: "bag",     plural: "bags" },
};

const EXPLICIT_UNIT_ALIASES: Partial<Record<string, Unit>> = {
  // Weight
  gram: "g",
  grams: "g",
  kilogram: "kg",
  kilograms: "kg",
  ounce: "oz",
  ounces: "oz",
  pound: "lb",
  pounds: "lb",
  lbs: "lb",
  // Metric volume
  millilitre: "ml",
  millilitres: "ml",
  milliliter: "ml",
  milliliters: "ml",
  litre: "l",
  litres: "l",
  liter: "l",
  liters: "l",
  // Spoon
  tsps: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tbsps: "tbsp",
  "au tablespoon": "au_tbsp",
  "au tablespoons": "au_tbsp",
  "australian tablespoon": "au_tbsp",
  "australian tablespoons": "au_tbsp",
  "au tbsp": "au_tbsp",
  "australian tbsp": "au_tbsp",
  // Cup variants (by region) – bare "cup" defaults to us_cup
  cup: "us_cup",
  cups: "us_cup",
  c: "us_cup", // cooklang-rs normalises `cup` → `c` when a scale is passed
  "us cup": "us_cup",
  "us cups": "us_cup",
  "american cup": "us_cup",
  "american cups": "us_cup",
  "uk cup": "uk_cup",
  "uk cups": "uk_cup",
  "british cup": "uk_cup",
  "au cup": "au_cup",
  "au cups": "au_cup",
  "australian cup": "au_cup",
  "australian cups": "au_cup",
  "imperial cup": "uk_imperial_cup",
  "imperial cups": "uk_imperial_cup",
  // Pint variants – bare "pint" defaults to uk_pint (the more common culinary pint outside the US)
  pint: "uk_pint",
  pints: "uk_pint",
  "us pint": "us_pint",
  "us pints": "us_pint",
  "american pint": "us_pint",
  "uk pint": "uk_pint",
  "uk pints": "uk_pint",
  "british pint": "uk_pint",
  "imperial pint": "uk_pint",
  "imperial pints": "uk_pint",
  // Fluid ounces (default to US; UK requires explicit qualifier)
  "fl oz": "us_fl_oz",
  "fl. oz": "us_fl_oz",
  "fl. oz.": "us_fl_oz",
  "fluid oz": "us_fl_oz",
  "fluid ounce": "us_fl_oz",
  "fluid ounces": "us_fl_oz",
  "us fl oz": "us_fl_oz",
  "uk fl oz": "uk_fl_oz",
  "british fl oz": "uk_fl_oz",
  "imperial fl oz": "uk_fl_oz",
  // Discrete
  can: "tin",
  cans: "tin",
  pk: "piece",
  pack: "piece",
  packs: "piece",
};

const NORMALIZED_UNIT_ALIASES: Record<string, Unit> = (() => {
  const aliases: Record<string, Unit> = {};

  for (const [unit, labels] of Object.entries(UNIT_LABELS) as Array<
    [Unit, UnitLabel]
  >) {
    aliases[unit] = unit;
    const singular = labels.singular.toLowerCase();
    const plural = labels.plural.toLowerCase();
    // First unit to claim a display label wins. Multiple regional variants
    // share the same label text (e.g. us_cup, uk_cup, au_cup all render as
    // "cup"), so without this guard the last one iterated would silently
    // overwrite the earlier ones. Explicit aliases in EXPLICIT_UNIT_ALIASES
    // are applied afterwards and can still override any entry set here.
    if (!aliases[singular]) aliases[singular] = unit;
    if (!aliases[plural]) aliases[plural] = unit;
  }

  // Explicit aliases take precedence over label-derived ones.
  for (const [alias, unit] of Object.entries(EXPLICIT_UNIT_ALIASES)) {
    if (unit != null) aliases[alias] = unit;
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
  g:               "weight",
  kg:              "weight",
  oz:              "weight",
  lb:              "weight",
  ml:              "volume",
  l:               "volume",
  tsp:             "spoon",
  tbsp:            "spoon",
  au_tbsp:         "spoon",
  us_cup:          "volume",
  uk_cup:          "volume",
  au_cup:          "volume",
  uk_imperial_cup: "volume",
  uk_pint:         "volume",
  us_pint:         "volume",
  us_fl_oz:        "volume",
  uk_fl_oz:        "volume",
  pinch:           "discrete",
  handful:         "discrete",
  piece:           "discrete",
  slice:           "discrete",
  clove:           "discrete",
  tin:             "discrete",
  cube:            "discrete",
  sachet:          "discrete",
  bag:             "discrete",
};
