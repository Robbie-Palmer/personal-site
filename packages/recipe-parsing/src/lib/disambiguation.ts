import type { CanonicalIngredient } from "../schemas/canonical-ingredients.js";
import type { PredictionEntry } from "../schemas/ground-truth.js";
import type { IngredientCanonicalizationDecision } from "./ingredient-canonicalization.js";
import type {
  DisambiguationChoice,
  RecipeContext,
  UnresolvedItem,
} from "./openrouter.js";

export function buildCategoryMap(
  ingredients: CanonicalIngredient[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const { slug, category } of ingredients) {
    map.set(slug, category);
  }
  return map;
}

export function collectUnresolved(
  decisions: IngredientCanonicalizationDecision[],
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

/**
 * Validate LLM choices against the candidate lists and mark the matching
 * decisions as resolved by the LLM. Invalid choices are skipped with a warning.
 */
export function applyDisambiguationChoices(
  decisions: IngredientCanonicalizationDecision[],
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
      console.warn(
        `  LLM returned unknown ingredient slug "${choice.slug}", skipping`,
      );
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
