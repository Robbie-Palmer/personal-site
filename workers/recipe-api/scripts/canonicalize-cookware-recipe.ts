import {
	type SavedRecipePayload,
	SavedRecipePayloadSchema,
} from "recipe-domain";
import { canonicalEquipment } from "recipe-parsing/canonical-equipment-data";
import {
	applyCanonicalTokens,
	canonicalCookwareReplacements,
} from "recipe-parsing/cooklang-token-rewrite";
import { canonicalizeCookwareList } from "recipe-parsing/equipment-canonicalization";
import {
	buildOntology,
	buildOntologyIndex,
} from "recipe-parsing/slug-matching";

const equipment = buildOntology(canonicalEquipment.equipment, "equipment");
const equipmentIndex = buildOntologyIndex(equipment);

export interface CookwareCanonicalization {
	payload: SavedRecipePayload;
	changed: boolean;
	replacements: Map<string, string>;
	cookwareBefore: string[];
	cookwareAfter: string[];
}

function canonicalNames(names: string[]): string[] {
	return [
		...new Set(
			canonicalizeCookwareList(names, equipment, equipmentIndex).cookware.map(
				(name) => name.trim().toLowerCase(),
			),
		),
	];
}

function sameList(left: string[], right: string[]): boolean {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}

/**
 * Resolves a recipe's cookware against the canonical equipment registry. The
 * structured equipment list moves to the canonical name; the cooklang source
 * keeps the authored wording as a `#canonical|authored{}` alias so the prose
 * reads exactly as before. The transform is idempotent — a body that already
 * uses canonical names comes back unchanged.
 */
export function canonicalizeSavedRecipeCookware(
	payload: SavedRecipePayload,
): CookwareCanonicalization {
	const { recipe } = payload;

	// The display values are the wording each cookware token shows in the prose
	// ("skillet", "large frying pan"); their registered names come from
	// canonicalizing them. Fall back to the stored equipment list for older
	// records saved without an instruction SDK.
	const authoredNames =
		recipe.instructionSdk?.cookwareDisplayValues ?? recipe.cookware;
	const { decisions } = canonicalizeCookwareList(
		authoredNames,
		equipment,
		equipmentIndex,
	);
	const replacements = canonicalCookwareReplacements(decisions);

	const nextSource = applyCanonicalTokens(payload.source, "#", replacements);
	const nextCookBody = applyCanonicalTokens(recipe.cookBody, "#", replacements);
	const nextCookware = canonicalNames(recipe.cookware);

	const changed =
		nextSource !== payload.source ||
		nextCookBody !== recipe.cookBody ||
		!sameList(nextCookware, recipe.cookware);

	return {
		payload: changed
			? SavedRecipePayloadSchema.parse({
					...payload,
					source: nextSource,
					recipe: { ...recipe, cookBody: nextCookBody, cookware: nextCookware },
				})
			: payload,
		changed,
		replacements,
		cookwareBefore: recipe.cookware,
		cookwareAfter: nextCookware,
	};
}
