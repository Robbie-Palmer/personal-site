import { describe, expect, it, vi } from "vitest";
import {
  applyDisambiguationChoices,
  applyEquipmentDecisionsToEntry,
  applyLlmDecisionsToEntry,
  buildCategoryMap,
  collectUnresolved,
  extractEquipmentContext,
  extractRecipeContext,
} from "../../src/lib/disambiguation.js";
import type { IngredientCanonicalizationDecision } from "../../src/lib/ingredient-canonicalization.js";
import type { EquipmentCanonicalizationDecision } from "../../src/lib/equipment-canonicalization.js";
import type { PredictionEntry } from "../../src/schemas/ground-truth.js";

function ingredientDecision(
  overrides: Partial<IngredientCanonicalizationDecision> = {},
): IngredientCanonicalizationDecision {
  return {
    originalSlug: "pepper",
    baseSlug: "pepper",
    canonicalSlug: "pepper",
    method: "none",
    reason: "below-threshold",
    candidates: [{ slug: "bell-pepper", score: 0.7 }],
    ...overrides,
  };
}

function equipmentDecision(
  overrides: Partial<EquipmentCanonicalizationDecision> = {},
): EquipmentCanonicalizationDecision {
  return {
    originalName: "oven thing",
    baseSlug: "oven-thing",
    canonicalSlug: "oven-thing",
    method: "none",
    reason: "below-threshold",
    candidates: [{ slug: "baking-tray", score: 0.6 }],
    ...overrides,
  };
}

function entry(): PredictionEntry {
  return {
    images: ["a.jpg"],
    predicted: {
      title: "Traybake",
      description: "d",
      cuisine: ["British"],
      servings: 2,
      ingredientGroups: [{ items: [{ ingredient: "pepper", amount: 1 }] }],
      instructions: ["Roast everything."],
      cookware: ["oven thing"],
    },
  };
}

describe("buildCategoryMap", () => {
  it("should map slugs to categories", () => {
    const map = buildCategoryMap([
      { slug: "bell-pepper", category: "vegetable" },
      { slug: "baking-tray", category: "bakeware" },
    ]);
    expect(map.get("bell-pepper")).toBe("vegetable");
    expect(map.get("baking-tray")).toBe("bakeware");
  });
});

describe("collectUnresolved", () => {
  const categories = new Map([["bell-pepper", "vegetable"]]);

  it("should collect unresolved decisions with their candidate categories", () => {
    expect(collectUnresolved([ingredientDecision()], categories)).toEqual([
      {
        slug: "pepper",
        candidates: [{ slug: "bell-pepper", category: "vegetable" }],
      },
    ]);
  });

  it("should deduplicate repeated slugs and skip resolved or candidate-less decisions", () => {
    const items = collectUnresolved(
      [
        ingredientDecision(),
        ingredientDecision(),
        ingredientDecision({ method: "exact" }),
        ingredientDecision({ baseSlug: "mystery", candidates: [] }),
      ],
      categories,
    );
    expect(items).toHaveLength(1);
  });

  it("should fall back to the other category for unknown candidates", () => {
    const items = collectUnresolved([ingredientDecision()], new Map());
    expect(items[0]?.candidates[0]?.category).toBe("other");
  });
});

describe("extractRecipeContext", () => {
  it("should list the already resolved ingredients", () => {
    const context = extractRecipeContext(entry(), [
      ingredientDecision({ method: "exact", canonicalSlug: "garlic" }),
      ingredientDecision(),
    ]);
    expect(context).toEqual({
      title: "Traybake",
      cuisine: ["British"],
      otherIngredients: ["garlic"],
    });
  });
});

describe("extractEquipmentContext", () => {
  it("should list resolved equipment as display names alongside the instructions", () => {
    const context = extractEquipmentContext(entry(), [
      equipmentDecision({ method: "exact", canonicalSlug: "frying-pan" }),
      equipmentDecision(),
    ]);
    expect(context).toEqual({
      title: "Traybake",
      cuisine: ["British"],
      otherEquipment: ["frying pan"],
      instructions: ["Roast everything."],
    });
  });
});

describe("applyDisambiguationChoices", () => {
  const unresolved = [
    {
      slug: "pepper",
      candidates: [{ slug: "bell-pepper", category: "vegetable" }],
    },
  ];

  it("should mark matching decisions as resolved by the LLM", () => {
    const decisions = [ingredientDecision()];
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    applyDisambiguationChoices(decisions, unresolved, [
      { slug: "pepper", canonicalSlug: "bell-pepper", confidence: "high" },
    ]);

    expect(decisions[0]).toMatchObject({
      canonicalSlug: "bell-pepper",
      method: "llm",
      reason: undefined,
    });
    log.mockRestore();
  });

  it("should skip choices for slugs that were never sent", () => {
    const decisions = [ingredientDecision()];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    applyDisambiguationChoices(decisions, unresolved, [
      { slug: "invented", canonicalSlug: "bell-pepper", confidence: "low" },
    ]);

    expect(decisions[0]?.method).toBe("none");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('unknown slug "invented"'),
    );
    warn.mockRestore();
  });

  it("should skip choices outside the candidate list", () => {
    const decisions = [ingredientDecision()];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    applyDisambiguationChoices(decisions, unresolved, [
      { slug: "pepper", canonicalSlug: "black-pepper", confidence: "low" },
    ]);

    expect(decisions[0]?.method).toBe("none");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("not in the candidate list"),
    );
    warn.mockRestore();
  });
});

describe("applyLlmDecisionsToEntry", () => {
  it("should rewrite ingredients the LLM resolved", () => {
    const updated = applyLlmDecisionsToEntry(entry(), [
      ingredientDecision({ method: "llm", canonicalSlug: "bell-pepper" }),
    ]);
    expect(
      updated.predicted.ingredientGroups[0]?.items[0]?.ingredient,
    ).toBe("bell-pepper");
  });

  it("should return the entry untouched when nothing was resolved", () => {
    const original = entry();
    expect(applyLlmDecisionsToEntry(original, [ingredientDecision()])).toBe(
      original,
    );
  });
});

describe("applyEquipmentDecisionsToEntry", () => {
  it("should rebuild cookware from the decisions", () => {
    const updated = applyEquipmentDecisionsToEntry(entry(), [
      equipmentDecision({ method: "llm", canonicalSlug: "baking-tray" }),
    ]);
    expect(updated.predicted.cookware).toEqual(["baking tray"]);
  });

  it("should return the entry untouched when the cookware is unchanged", () => {
    const original = entry();
    expect(
      applyEquipmentDecisionsToEntry(original, [equipmentDecision()]),
    ).toBe(original);
  });
});
