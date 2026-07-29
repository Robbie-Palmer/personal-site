import { describe, expect, it } from "vitest";
import {
	applyCanonicalTokens,
	canonicalCookwareReplacements,
	normalizeTokenName,
} from "../../src/lib/cooklang-token-rewrite.js";
import type { EquipmentCanonicalizationDecision } from "../../src/lib/equipment-canonicalization.js";

function decision(
	originalName: string,
	canonicalSlug: string,
): EquipmentCanonicalizationDecision {
	return {
		originalName,
		canonicalSlug,
		baseSlug: normalizeTokenName(originalName),
		method: "exact",
		candidates: [],
	} as EquipmentCanonicalizationDecision;
}

describe("normalizeTokenName", () => {
	it("lowercases, trims, and collapses separators to a slug", () => {
		expect(normalizeTokenName("  Baking   Tray ")).toBe("baking-tray");
		expect(normalizeTokenName("tin-foil")).toBe("tin-foil");
		expect(normalizeTokenName("Frying Pan")).toBe("frying-pan");
	});
});

describe("canonicalCookwareReplacements", () => {
	it("maps a divergent name to its canonical display name", () => {
		const replacements = canonicalCookwareReplacements([
			decision("forks", "fork"),
		]);
		expect(replacements.get("forks")).toBe("fork");
	});

	it("omits a decision whose name already equals its canonical display", () => {
		const replacements = canonicalCookwareReplacements([
			decision("fork", "fork"),
		]);
		expect(replacements.size).toBe(0);
	});
});

describe("applyCanonicalTokens", () => {
	it("returns the body untouched when there are no replacements", () => {
		const body = "Serve on a #plate{}.";
		expect(applyCanonicalTokens(body, "#", new Map())).toBe(body);
	});

	it("rewrites a bare token and keeps the authored wording as the alias", () => {
		expect(
			applyCanonicalTokens(
				"Fry in a #skillet{}.",
				"#",
				new Map([["skillet", "frying pan"]]),
			),
		).toBe("Fry in a #frying pan|skillet{}.");
	});

	it("preserves the authored casing of the alias", () => {
		expect(
			applyCanonicalTokens(
				"Fry in a #Skillet{}.",
				"#",
				new Map([["skillet", "frying pan"]]),
			),
		).toBe("Fry in a #frying pan|Skillet{}.");
	});

	it("drops the alias when it differs from the canonical name only in case", () => {
		expect(
			applyCanonicalTokens(
				"Fry in a #Frying Pan{}.",
				"#",
				new Map([["frying-pan", "frying pan"]]),
			),
		).toBe("Fry in a #frying pan{}.");
	});

	it("rewrites only the registered name of a token that already has an alias", () => {
		expect(
			applyCanonicalTokens(
				"Roast on a #sheet pan|my tray{}.",
				"#",
				new Map([["sheet-pan", "baking tray"]]),
			),
		).toBe("Roast on a #baking tray|my tray{}.");
	});

	it("matches a token terminated by punctuation and adds no braces for a bare single word", () => {
		expect(
			applyCanonicalTokens(
				"Serve on a #Plate.",
				"#",
				new Map([["plate", "plate"]]),
			),
		).toBe("Serve on a #plate.");
	});

	it("adds braces when an aliased single-word token is terminated by punctuation", () => {
		expect(
			applyCanonicalTokens(
				"Serve with two #forks.",
				"#",
				new Map([["forks", "fork"]]),
			),
		).toBe("Serve with two #fork|forks{}.");
	});

	it("rewrites ingredient tokens with the @ marker", () => {
		expect(
			applyCanonicalTokens(
				"Add @capsicum{}.",
				"@",
				new Map([["capsicum", "bell pepper"]]),
			),
		).toBe("Add @bell pepper|capsicum{}.");
	});

	it("matches a longer name before its shorter substring", () => {
		expect(
			applyCanonicalTokens(
				"Use a #frying pan{} and a #pan{}.",
				"#",
				new Map([
					["pan", "pot"],
					["frying-pan", "frying pan"],
				]),
			),
		).toBe("Use a #frying pan{} and a #pot|pan{}.");
	});

	it("leaves a token whose name is not in the replacements", () => {
		const body = "Use a #whisk{}.";
		expect(applyCanonicalTokens(body, "#", new Map([["forks", "fork"]]))).toBe(
			body,
		);
	});
});
