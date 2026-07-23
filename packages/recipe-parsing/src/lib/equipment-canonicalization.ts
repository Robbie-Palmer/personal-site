import { normalizeSlug } from "recipe-domain/slugs";
import {
  pluralizeIngredientTerm,
  singularizeIngredientTerm,
} from "recipe-domain/pluralization";
import {
  detokenize,
  matchSlug,
  tokenize,
  uniqueSlugs,
  type CandidateScore,
  type CanonicalizationMethod,
  type CanonicalizationReason,
  type OntologyIndex,
} from "./slug-matching.js";

export interface EquipmentCanonicalizationDecision {
  originalName: string;
  baseSlug: string;
  canonicalSlug: string;
  method: CanonicalizationMethod;
  reason?: CanonicalizationReason;
  score?: number;
  threshold?: number;
  margin?: number;
  candidates: CandidateScore[];
}

const EQUIPMENT_ALIASES: Record<string, string> = {
  skillet: "frying-pan",
  frypan: "frying-pan",
  "fry-pan": "frying-pan",
  "saute-pan": "frying-pan",
  "saut-pan": "frying-pan",
  "sautee-pan": "frying-pan",
  pan: "frying-pan",
  "sauce-pan": "saucepan",
  pot: "saucepan",
  "cooking-pot": "saucepan",
  "stock-pot": "stockpot",
  "soup-pot": "stockpot",
  "casserole-pot": "dutch-oven",
  "sheet-pan": "baking-tray",
  "sheet-tray": "baking-tray",
  "baking-sheet": "baking-tray",
  "baking-pan": "baking-tray",
  "oven-tray": "baking-tray",
  tray: "baking-tray",
  "baking-dish": "oven-dish",
  "casserole-dish": "oven-dish",
  "ovenproof-dish": "oven-dish",
  "gratin-dish": "oven-dish",
  "roasting-pan": "roasting-tin",
  "roasting-dish": "roasting-tin",
  "roasting-tray": "roasting-tin",
  "cake-pan": "cake-tin",
  "springform-pan": "springform-tin",
  "loaf-pan": "loaf-tin",
  "muffin-pan": "muffin-tin",
  "muffin-tray": "muffin-tin",
  "cupcake-tin": "muffin-tin",
  "wire-rack": "cooling-rack",
  rack: "cooling-rack",
  strainer: "sieve",
  colander: "sieve",
  sifter: "sieve",
  griddle: "griddle-pan",
  "grill-pan": "griddle-pan",
  bbq: "barbecue",
  "immersion-blender": "stick-blender",
  "hand-blender": "stick-blender",
  liquidiser: "blender",
  liquidizer: "blender",
  mixer: "stand-mixer",
  "electric-mixer": "hand-mixer",
  "electric-whisk": "hand-mixer",
  "balloon-whisk": "whisk",
  "chefs-knife": "knife",
  "cooks-knife": "knife",
  "cutting-board": "chopping-board",
  board: "chopping-board",
  "mortar-and-pestle": "pestle-and-mortar",
  mortar: "pestle-and-mortar",
  pestle: "pestle-and-mortar",
  "vegetable-peeler": "peeler",
  "potato-peeler": "peeler",
  "box-grater": "grater",
  "cheese-grater": "grater",
  microplane: "grater",
  "lemon-zester": "zester",
  "fish-slice": "spatula",
  turner: "spatula",
  "kitchen-scissors": "scissors",
  "kitchen-shears": "scissors",
  shears: "scissors",
  "kitchen-scales": "scales",
  "weighing-scales": "scales",
  "measuring-cup": "measuring-jug",
  "meat-thermometer": "thermometer",
  "food-thermometer": "thermometer",
  probe: "thermometer",
  "microwave-oven": "microwave",
  stove: "hob",
  stovetop: "hob",
  hotplate: "hob",
  cooker: "hob",
  "deep-fat-fryer": "deep-fryer",
  "crock-pot": "slow-cooker",
  crockpot: "slow-cooker",
  "instant-pot": "pressure-cooker",
  "steamer-basket": "steamer",
  "bamboo-steamer": "steamer",
  "tin-foil": "foil",
  "kitchen-foil": "foil",
  "aluminium-foil": "foil",
  "aluminum-foil": "foil",
  "greaseproof-paper": "baking-paper",
  "parchment-paper": "baking-paper",
  parchment: "baking-paper",
  "baking-parchment": "baking-paper",
  "plastic-wrap": "cling-film",
};

// Size, material, and condition adjectives never change which piece of
// equipment is meant.
const EQUIPMENT_MODIFIER_TOKENS = new Set([
  "large",
  "small",
  "medium",
  "big",
  "wide",
  "deep",
  "shallow",
  "heavy",
  "bottomed",
  "based",
  "sided",
  "high",
  "fine",
  "mesh",
  "sturdy",
  "clean",
  "sharp",
  "nonstick",
  "non",
  "stick",
  "cast",
  "iron",
  "stainless",
  "steel",
  "metal",
  "wooden",
  "silicone",
  "plastic",
  "glass",
  "ceramic",
]);

// These can be part of a canonical name ("mixing bowl"), so they are only
// dropped after the fuller forms fail to match.
const EQUIPMENT_WEAK_TOKENS = new Set([
  "mixing",
  "separate",
  "another",
  "second",
  "spare",
]);

export function equipmentDisplayName(slug: string): string {
  return slug.replace(/-/g, " ");
}

function generateEquipmentCandidates(baseSlug: string): string[] {
  const out = new Set<string>([baseSlug]);
  const tokens = tokenize(baseSlug);

  const withoutModifiers = tokens.filter(
    (token) => !EQUIPMENT_MODIFIER_TOKENS.has(token),
  );
  if (withoutModifiers.length > 0 && withoutModifiers.length !== tokens.length) {
    out.add(detokenize(withoutModifiers));
  }

  const withoutWeakTokens = withoutModifiers.filter(
    (token) => !EQUIPMENT_WEAK_TOKENS.has(token),
  );
  if (
    withoutWeakTokens.length > 0 &&
    withoutWeakTokens.length !== withoutModifiers.length
  ) {
    out.add(detokenize(withoutWeakTokens));
  }

  for (const candidate of [...out]) {
    const phrase = equipmentDisplayName(candidate);
    const singular = normalizeSlug(singularizeIngredientTerm(phrase));
    const plural = normalizeSlug(pluralizeIngredientTerm(phrase));
    if (singular) out.add(singular);
    if (plural) out.add(plural);
  }

  for (const candidate of [...out]) {
    const alias = EQUIPMENT_ALIASES[candidate];
    if (alias) out.add(alias);
  }

  return uniqueSlugs([...out]);
}

export function canonicalizeEquipmentName(params: {
  rawName: string;
  ontology: Set<string>;
  ontologyIndex?: OntologyIndex;
}): EquipmentCanonicalizationDecision {
  const baseSlug = normalizeSlug(params.rawName);
  const match = matchSlug({
    baseSlug,
    candidateSlugs: generateEquipmentCandidates(baseSlug),
    ontology: params.ontology,
    ontologyIndex: params.ontologyIndex,
  });

  return { originalName: params.rawName, ...match };
}

export function cookwareFromDecisions(
  decisions: EquipmentCanonicalizationDecision[],
): string[] {
  return [
    ...new Set(
      decisions.map((decision) => equipmentDisplayName(decision.canonicalSlug)),
    ),
  ];
}

export function canonicalizeCookwareList(
  cookware: string[],
  ontology: Set<string>,
  ontologyIndex?: OntologyIndex,
): {
  cookware: string[];
  decisions: EquipmentCanonicalizationDecision[];
} {
  const decisions = cookware
    .map((name) => name.trim())
    .filter((name) => name !== "")
    .map((rawName) =>
      canonicalizeEquipmentName({ rawName, ontology, ontologyIndex }),
    );

  return { cookware: cookwareFromDecisions(decisions), decisions };
}
