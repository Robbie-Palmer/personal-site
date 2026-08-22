import { ingredients as definedIngredients } from "@/content/recipes/ingredients";
import {
  type IngredientSlug,
  normalizeIngredientSlugForOutput,
  resolveIngredientSlug,
} from "@/lib/domain/recipe/ingredient";

const knownIngredientSlugs = new Set<IngredientSlug>(
  definedIngredients.map(resolveIngredientSlug),
);

/**
 * Use the visible ingredient as the identity when it names another catalog
 * ingredient exactly. Cooklang aliases normally preserve harmless wording
 * differences, but `@butter|unsalted butter{}` must not let generic butter in
 * the pantry satisfy a request for unsalted butter.
 */
export function resolveDisplayedIngredientSlug(
  registeredName: string,
  displayName?: string,
): IngredientSlug {
  const registeredSlug: IngredientSlug =
    normalizeIngredientSlugForOutput(registeredName);
  if (!displayName) return registeredSlug;

  const displayedSlug = resolveIngredientSlug({ name: displayName });
  return knownIngredientSlugs.has(displayedSlug)
    ? displayedSlug
    : registeredSlug;
}
