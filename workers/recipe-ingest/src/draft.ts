import { recipeToCooklang } from "recipe-parsing/cooklang";
import type { Recipe } from "recipe-parsing/schemas/ground-truth";
import type { CooklangRecipe } from "recipe-parsing/schemas/stage-artifacts";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
        replacements.set(originalIngredient.toLowerCase(), finalizedIngredient);
      }
    }
  }
  return replacements;
}

function applyCanonicalIngredients(
  body: string,
  replacements: Map<string, string>,
): string {
  if (replacements.size === 0) return body;

  const alternatives = [...replacements.keys()]
    .sort((left, right) => right.length - left.length)
    .map((slug) =>
      slug
        .split(/[-\s]+/u)
        .map(escapeRegExp)
        .join("[\\s-]+"),
    );
  const ingredientToken = new RegExp(
    `@(?:${alternatives.join("|")})(?=\\{|[\\s.,;:()!?]|$)`,
    "giu",
  );

  return body.replace(ingredientToken, (match) => {
    const originalSlug = match
      .slice(1)
      .trim()
      .replace(/[-\s]+/gu, "-")
      .toLowerCase();
    const canonicalSlug = replacements.get(originalSlug);
    return canonicalSlug ? `@${canonicalSlug.replaceAll("-", " ")}` : match;
  });
}

export function buildFinalDraft(
  sourceImageKeys: string[],
  normalizedCooklang: CooklangRecipe,
  recipe: Recipe,
) {
  const canonicalCooklang = recipeToCooklang(recipe);
  const originalRecipe = normalizedCooklang.derived;
  const body = originalRecipe
    ? applyCanonicalIngredients(
        normalizedCooklang.body,
        canonicalIngredientReplacements(originalRecipe, recipe),
      )
    : normalizedCooklang.body;

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
