import {
	type SavedRecipePayload,
	SavedRecipePayloadSchema,
} from "recipe-domain";
import { canonicalEquipment } from "recipe-parsing/canonical-equipment-data";
import { extractCookwareFromBody } from "recipe-parsing/cooklang";
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

function sameList(left: string[], right: string[]): boolean {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}

/**
 * Resolves a recipe's cookware against the canonical equipment registry. The
 * registered names come from the cooklang source itself, so the rewrite and the
 * structured equipment list stay in step: the source keeps each authored
 * wording as a `#canonical|authored{}` alias while the equipment list and the
 * cooklang tokens both carry the canonical name. Deriving from the source is
 * what keeps a token that already has an alias (`#baking dish|casserole{}`)
 * consistent — the registered name is what gets rewritten, not the alias. The
 * transform is idempotent; a body already on canonical names comes back
 * unchanged.
 */
export function canonicalizeSavedRecipeCookware(
	payload: SavedRecipePayload,
): CookwareCanonicalization {
	const { recipe } = payload;

	const { cookware, decisions } = canonicalizeCookwareList(
		extractCookwareFromBody(payload.source),
		equipment,
		equipmentIndex,
	);
	const replacements = canonicalCookwareReplacements(decisions);

	const nextSource = applyCanonicalTokens(payload.source, "#", replacements);
	const nextCookBody = applyCanonicalTokens(recipe.cookBody, "#", replacements);
	const nextCookware = [
		...new Set(cookware.map((name) => name.trim().toLowerCase())),
	];

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
