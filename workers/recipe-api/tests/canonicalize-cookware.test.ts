import { SavedRecipePayloadSchema } from "recipe-domain";
import { describe, expect, it } from "vitest";
import { canonicalizeSavedRecipeCookware } from "../scripts/canonicalize-cookware-recipe";

function payload(options: {
	source: string;
	cookware: string[];
	cookwareDisplayValues?: string[];
}) {
	return SavedRecipePayloadSchema.parse({
		version: 1,
		source: options.source,
		recipe: {
			title: "Test Recipe",
			description: "A recipe for testing.",
			date: "2026-07-15",
			cuisine: [],
			servings: 2,
			tags: [],
			cookBody: options.source,
			cookware: options.cookware,
			ingredientGroups: [{ items: [{ ingredient: "salt", amount: 1 }] }],
			instructions: ["Do the thing."],
			...(options.cookwareDisplayValues
				? {
						instructionSdk: {
							sections: [],
							ingredientNames: [],
							ingredientDisplayValues: [],
							ingredientAmounts: [],
							ingredientUnits: [],
							cookwareDisplayValues: options.cookwareDisplayValues,
							inlineQuantityDisplayValues: [],
							timerDisplayValues: [],
							timerDurationSeconds: [],
						},
					}
				: {}),
		},
	});
}

describe("canonicalizeSavedRecipeCookware", () => {
	it("collapses a plural to its canonical singular and keeps the prose", () => {
		const result = canonicalizeSavedRecipeCookware(
			payload({
				source: "Serve with two #forks{}.",
				cookware: ["forks"],
			}),
		);

		expect(result.changed).toBe(true);
		expect(result.cookwareAfter).toEqual(["fork"]);
		expect(result.payload.source).toBe("Serve with two #fork|forks{}.");
		expect(result.payload.recipe.cookBody).toBe(
			"Serve with two #fork|forks{}.",
		);
	});

	it("merges divergent spellings into one canonical entry", () => {
		const result = canonicalizeSavedRecipeCookware(
			payload({
				source: "Grab a #fork{} and a #forks{}.",
				cookware: ["fork", "forks"],
			}),
		);

		expect(result.cookwareAfter).toEqual(["fork"]);
		expect(result.payload.source).toBe("Grab a #fork{} and a #fork|forks{}.");
	});

	it("resolves an alias to its canonical equipment name", () => {
		const result = canonicalizeSavedRecipeCookware(
			payload({
				source: "Bake in a #baking dish{}.",
				cookware: ["baking dish"],
			}),
		);

		expect(result.cookwareAfter).toEqual(["oven dish"]);
		expect(result.payload.source).toBe("Bake in a #oven dish|baking dish{}.");
	});

	it("collapses baking dish, tin, and tray duplicates across recipes", () => {
		const names = (source: string, cookware: string[]) =>
			canonicalizeSavedRecipeCookware(payload({ source, cookware }))
				.cookwareAfter;

		expect(names("Use a #baking dish{}.", ["baking dish"])).toEqual([
			"oven dish",
		]);
		expect(names("Use a #baking sheet{}.", ["baking sheet"])).toEqual([
			"baking tray",
		]);
		expect(names("Use a #sheet pan{}.", ["sheet pan"])).toEqual([
			"baking tray",
		]);
	});

	it("prefers the instruction SDK display wording as the authored alias", () => {
		const result = canonicalizeSavedRecipeCookware(
			payload({
				source: "Fry in a #skillet{}.",
				cookware: ["skillet"],
				cookwareDisplayValues: ["skillet"],
			}),
		);

		expect(result.cookwareAfter).toEqual(["frying pan"]);
		expect(result.payload.source).toBe("Fry in a #frying pan|skillet{}.");
	});

	it("leaves an already-canonical recipe untouched", () => {
		const input = payload({
			source: "Fry in a #frying pan|skillet{}.",
			cookware: ["frying pan"],
		});
		const result = canonicalizeSavedRecipeCookware(input);

		expect(result.changed).toBe(false);
		expect(result.payload).toBe(input);
	});
});
