import { recipeToCooklang } from "recipe-parsing/cooklang";
import {
	applyCanonicalTokens,
	canonicalCookwareReplacements,
	normalizeTokenName,
} from "recipe-parsing/cooklang-token-rewrite";
import type { EquipmentCanonicalizationDecision } from "recipe-parsing/equipment-canonicalization";
import type { Recipe } from "recipe-parsing/schemas/ground-truth";
import type { CooklangRecipe } from "recipe-parsing/schemas/stage-artifacts";

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
