import { deriveRecipeFromCooklang } from "../../../../src/lib/cooklang.js";
import type { ParsedRecipe } from "recipe-domain";
import type { CooklangRecipe } from "../types/extraction";

export function deriveNormalizedRecipe(
  cooklang: CooklangRecipe,
): { recipe: ParsedRecipe | null; diagnostics: string[] } {
  const result = deriveRecipeFromCooklang({
    ...cooklang,
    derived: undefined,
    diagnostics: [],
  });
  return {
    recipe: result.derived ?? null,
    diagnostics: result.diagnostics,
  };
}
