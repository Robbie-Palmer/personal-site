import { recipeToCooklang } from "recipe-parsing/cooklang";
import type { Recipe } from "recipe-parsing/schemas/ground-truth";

export function buildFinalDraft(
  sourceImageKeys: string[],
  recipe: Recipe,
  diagnostics: string[],
) {
  const canonicalCooklang = recipeToCooklang(recipe);

  return {
    sourceImageKeys,
    cooklang: {
      frontmatter: canonicalCooklang.frontmatter,
      body: canonicalCooklang.body,
      diagnostics: [...diagnostics, ...canonicalCooklang.diagnostics],
    },
    recipe,
  };
}
