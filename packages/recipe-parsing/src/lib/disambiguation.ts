import type { PredictionEntry } from "../schemas/ground-truth.js";
import {
  cookwareFromDecisions,
  equipmentDisplayName,
  type EquipmentCanonicalizationDecision,
} from "./equipment-canonicalization.js";
import type { IngredientCanonicalizationDecision } from "./ingredient-canonicalization.js";
import type {
  CandidateScore,
  CanonicalizationMethod,
  CanonicalizationReason,
} from "./slug-matching.js";
import type {
  DisambiguationChoice,
  EquipmentContext,
  RecipeContext,
  UnresolvedItem,
} from "./openrouter.js";

interface ResolvableDecision {
  baseSlug: string;
  canonicalSlug: string;
  method: CanonicalizationMethod;
  reason?: CanonicalizationReason;
  candidates: CandidateScore[];
}

export function buildCategoryMap(
  entries: Array<{ slug: string; category: string }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const { slug, category } of entries) {
    map.set(slug, category);
  }
  return map;
}

export function collectUnresolved(
  decisions: ResolvableDecision[],
  categoryMap: Map<string, string>,
): UnresolvedItem[] {
  const seen = new Set<string>();
  const items: UnresolvedItem[] = [];
  for (const d of decisions) {
    if (d.method !== "none" || d.candidates.length === 0) continue;
    if (seen.has(d.baseSlug)) continue;
    seen.add(d.baseSlug);
    items.push({
      slug: d.baseSlug,
      candidates: d.candidates.map((c) => ({
        slug: c.slug,
        category: categoryMap.get(c.slug) ?? "other",
      })),
    });
  }
  return items;
}

export function extractRecipeContext(
  entry: PredictionEntry,
  decisions: IngredientCanonicalizationDecision[],
): RecipeContext {
  const resolved = decisions
    .filter((d) => d.method !== "none")
    .map((d) => d.canonicalSlug);
  return {
    title: entry.predicted.title,
    cuisine: entry.predicted.cuisine,
    otherIngredients: [...new Set(resolved)],
  };
}

export function extractEquipmentContext(
  entry: PredictionEntry,
  decisions: EquipmentCanonicalizationDecision[],
): EquipmentContext {
  const resolved = decisions
    .filter((d) => d.method !== "none")
    .map((d) => equipmentDisplayName(d.canonicalSlug));
  return {
    title: entry.predicted.title,
    cuisine: entry.predicted.cuisine,
    otherEquipment: [...new Set(resolved)],
    instructions: entry.predicted.instructions,
  };
}

/**
 * Validate LLM choices against the candidate lists and mark the matching
 * decisions as resolved by the LLM. Invalid choices are skipped with a warning.
 */
export function applyDisambiguationChoices(
  decisions: ResolvableDecision[],
  unresolved: UnresolvedItem[],
  choices: DisambiguationChoice[],
): void {
  const validCandidateSlugs = new Map<string, Set<string>>();
  for (const item of unresolved) {
    validCandidateSlugs.set(
      item.slug,
      new Set(item.candidates.map((c) => c.slug)),
    );
  }

  for (const choice of choices) {
    const allowed = validCandidateSlugs.get(choice.slug);
    if (!allowed) {
      console.warn(`  LLM returned unknown slug "${choice.slug}", skipping`);
      continue;
    }
    if (!allowed.has(choice.canonicalSlug)) {
      console.warn(
        `  LLM returned "${choice.canonicalSlug}" for "${choice.slug}" which is not in the candidate list, skipping`,
      );
      continue;
    }

    for (const d of decisions) {
      if (d.method === "none" && d.baseSlug === choice.slug) {
        d.canonicalSlug = choice.canonicalSlug;
        d.method = "llm";
        d.reason = undefined;
        console.log(
          `  LLM: "${choice.slug}" → ${choice.canonicalSlug} (${choice.confidence})`,
        );
      }
    }
  }
}

export function applyLlmDecisionsToEntry(
  entry: PredictionEntry,
  decisions: IngredientCanonicalizationDecision[],
): PredictionEntry {
  const decisionByOriginal = new Map<string, string>();
  for (const d of decisions) {
    if (d.method === "llm") {
      decisionByOriginal.set(d.originalSlug, d.canonicalSlug);
    }
  }

  if (decisionByOriginal.size === 0) return entry;

  return {
    ...entry,
    predicted: {
      ...entry.predicted,
      ingredientGroups: entry.predicted.ingredientGroups.map((group) => ({
        ...group,
        items: group.items.map((item) => {
          const resolved = decisionByOriginal.get(item.ingredient) ??
            decisionByOriginal.get(
              decisions.find(
                (d) => d.method === "llm" && d.baseSlug === item.ingredient,
              )?.originalSlug ?? "",
            );
          return resolved ? { ...item, ingredient: resolved } : item;
        }),
      })),
    },
  };
}

export function applyEquipmentDecisionsToEntry(
  entry: PredictionEntry,
  cookwareDecisions: EquipmentCanonicalizationDecision[],
): PredictionEntry {
  const cookware = cookwareFromDecisions(cookwareDecisions);
  const unchanged =
    cookware.length === entry.predicted.cookware.length &&
    cookware.every((name, index) => name === entry.predicted.cookware[index]);
  if (unchanged) return entry;

  return {
    ...entry,
    predicted: { ...entry.predicted, cookware },
  };
}
