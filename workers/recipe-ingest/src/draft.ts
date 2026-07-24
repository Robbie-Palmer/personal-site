import { recipeToCooklang } from "recipe-parsing/cooklang";
import {
  equipmentDisplayName,
  type EquipmentCanonicalizationDecision,
} from "recipe-parsing/equipment-canonicalization";
import type { Recipe } from "recipe-parsing/schemas/ground-truth";
import type { CooklangRecipe } from "recipe-parsing/schemas/stage-artifacts";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function canonicalIngredientReplacements(
  original: Recipe,
  finalized: Recipe,
): Map<string, string> {
  const replacements = new Map<string, string>();
  for (
    let groupIndex = 0;
    groupIndex < original.ingredientGroups.length;
    groupIndex++
  ) {
    const originalGroup = original.ingredientGroups[groupIndex];
    const finalizedGroup = finalized.ingredientGroups[groupIndex];
    if (!originalGroup || !finalizedGroup) continue;

    for (
      let itemIndex = 0;
      itemIndex < originalGroup.items.length;
      itemIndex++
    ) {
      const originalIngredient = originalGroup.items[itemIndex]?.ingredient;
      const finalizedIngredient = finalizedGroup.items[itemIndex]?.ingredient;
      if (
        originalIngredient &&
        finalizedIngredient &&
        originalIngredient !== finalizedIngredient
      ) {
        replacements.set(
          normalizeTokenName(originalIngredient),
          finalizedIngredient,
        );
      }
    }
  }
  return replacements;
}

function canonicalCookwareReplacements(
  decisions: EquipmentCanonicalizationDecision[],
): Map<string, string> {
  const replacements = new Map<string, string>();
  for (const decision of decisions) {
    const displayName = equipmentDisplayName(decision.canonicalSlug);
    if (decision.originalName !== displayName) {
      replacements.set(normalizeTokenName(decision.originalName), displayName);
    }
  }
  return replacements;
}

function normalizeTokenName(value: string): string {
  return value.trim().replace(/[-\s]+/gu, "-").toLowerCase();
}

function applyCanonicalTokens(
  body: string,
  marker: "@" | "#",
  replacements: Map<string, string>,
): string {
  if (replacements.size === 0) return body;

  const alternatives = [...replacements.keys()]
    .sort((left, right) => right.length - left.length)
    .map((slug) =>
      slug
        .split(/[-\s]+/u)
        .map(escapeRegExp)
        .join(String.raw`[\s-]+`),
    );
  // A token may already carry an alias, either because the recipe was written
  // that way or because a previous pass added one. Only its registered name is
  // rewritten; the words it displays are left as they are.
  const token = new RegExp(
    String.raw`${escapeRegExp(marker)}(?:${alternatives.join("|")})(\|[^{}|\n]*)?(?=\{|[.,;:()!?]|$|\s(?![^@#~{}\n]*\{))`,
    "giu",
  );

  return body.replace(
    token,
    (match: string, aliasPart: string | undefined, offset: number) => {
      const authoredName = match.slice(1, aliasPart ? -aliasPart.length : undefined);
      const canonicalName = replacements.get(normalizeTokenName(authoredName));
      if (!canonicalName) return match;

      // Cooklang reads `name|alias` as the registered name plus the words to
      // show, so the step keeps the wording the recipe used while the recipe
      // itself records the canonical one. Wording that differs only in spacing
      // or case is not worth preserving.
      const displayName = canonicalName.replaceAll("-", " ");
      const authoredAlias = aliasPart?.slice(1) || authoredName;
      const alias =
        normalizeTokenName(authoredAlias) === normalizeTokenName(displayName)
          ? undefined
          : authoredAlias;

      const rewritten = alias ? `${displayName}|${alias}` : displayName;
      const alreadyBraced = body[offset + match.length] === "{";
      const needsBraces = !alreadyBraced && /[\s|]/u.test(rewritten);
      return `${marker}${rewritten}${needsBraces ? "{}" : ""}`;
    },
  );
}

export function buildFinalDraft(
  sourceImageKeys: string[],
  normalizedCooklang: CooklangRecipe,
  recipe: Recipe,
  cookwareDecisions: EquipmentCanonicalizationDecision[],
) {
  const canonicalCooklang = recipeToCooklang(recipe);
  const originalRecipe = normalizedCooklang.derived;
  const ingredientBody = originalRecipe
    ? applyCanonicalTokens(
        normalizedCooklang.body,
        "@",
        canonicalIngredientReplacements(originalRecipe, recipe),
      )
    : normalizedCooklang.body;
  const body = applyCanonicalTokens(
    ingredientBody,
    "#",
    canonicalCookwareReplacements(cookwareDecisions),
  );

  return {
    sourceImageKeys,
    cooklang: {
      frontmatter: canonicalCooklang.frontmatter,
      body,
      diagnostics: normalizedCooklang.diagnostics,
    },
    recipe,
  };
}
