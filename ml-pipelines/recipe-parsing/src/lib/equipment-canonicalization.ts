import { normalizeSlug } from "recipe-domain/slugs";

export interface EquipmentCanonicalizationCandidate {
  name: string;
  score: number;
}

export interface EquipmentCanonicalizationDecision {
  originalName: string;
  baseName: string;
  canonicalName: string;
  method: "exact" | "none";
  candidates: EquipmentCanonicalizationCandidate[];
}

const EQUIPMENT_ALIAS_MAP: Record<string, string> = {
  skillet: "frying-pan",
  frypan: "frying-pan",
  "fry-pan": "frying-pan",
  "saute-pan": "frying-pan",
  "saut-pan": "frying-pan",
  "sheet-pan": "baking-tray",
  "sheet-tray": "baking-tray",
  "baking-sheet": "baking-tray",
  "baking-pan": "baking-tray",
  "baking-dish": "oven-dish",
  "casserole-dish": "oven-dish",
  strainer: "sieve",
  colander: "sieve",
};

const EQUIPMENT_MODIFIER_TOKENS = new Set([
  "large",
  "small",
  "medium",
  "deep",
  "shallow",
  "heavy",
  "bottomed",
  "heavy-bottomed",
  "based",
  "heavy-based",
  "separate",
  "mixing",
]);

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function toDisplayName(slug: string): string {
  return slug.replace(/-/g, " ");
}

function generateEquipmentCandidates(name: string): string[] {
  const base = normalizeSlug(name);
  const out = new Set<string>([base]);
  const tokens = base.split("-").filter(Boolean);

  const stripped = tokens.filter((token) => !EQUIPMENT_MODIFIER_TOKENS.has(token));
  if (stripped.length > 0 && stripped.length !== tokens.length) {
    out.add(stripped.join("-"));
  }

  for (const candidate of [...out]) {
    const alias = EQUIPMENT_ALIAS_MAP[candidate];
    if (alias) {
      out.add(alias);
    }
  }

  return unique([...out]);
}

export function canonicalizeEquipmentName(
  rawName: string,
): EquipmentCanonicalizationDecision {
  const baseSlug = normalizeSlug(rawName);
  const candidateSlugs = generateEquipmentCandidates(rawName);
  const canonicalSlug = candidateSlugs[candidateSlugs.length - 1] ?? baseSlug;

  return {
    originalName: rawName,
    baseName: toDisplayName(baseSlug),
    canonicalName: toDisplayName(canonicalSlug),
    method: canonicalSlug === baseSlug ? "none" : "exact",
    candidates: candidateSlugs.map((candidate, index) => ({
      name: toDisplayName(candidate),
      score: index === 0 ? 1 : 0.95,
    })),
  };
}

export function canonicalizeCookwareList(
  cookware: string[],
): {
  cookware: string[];
  decisions: EquipmentCanonicalizationDecision[];
} {
  const decisions = cookware.map((name) => canonicalizeEquipmentName(name));
  const canonicalized = decisions.map((decision) => decision.canonicalName);
  return {
    cookware: [...new Set(canonicalized)],
    decisions,
  };
}
