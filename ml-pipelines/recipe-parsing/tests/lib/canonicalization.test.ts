import { describe, expect, it, vi } from "vitest";
import {
  canonicalizeEntry,
  countResolvedByLlm,
  countUnresolved,
  disambiguateEntries,
  disambiguateEntry,
  withRetries,
  type EntryCanonicalization,
} from "../../src/lib/canonicalization.js";
import type { PredictionEntry } from "recipe-parsing/schemas/ground-truth";

const ontologies = {
  ingredients: new Set(["chicken-breast", "garlic", "bell-pepper", "chilli-powder"]),
  equipment: new Set(["frying-pan", "sieve", "baking-tray"]),
};

function makeEntry(overrides: Partial<PredictionEntry["predicted"]> = {}): PredictionEntry {
  return {
    images: ["a.jpg"],
    predicted: {
      title: "Chicken Traybake",
      description: "A traybake.",
      cuisine: ["British"],
      servings: 4,
      ingredientGroups: [
        { items: [{ ingredient: "chicken-fillets", amount: 2 }] },
      ],
      instructions: ["Roast everything."],
      cookware: ["large skillet"],
      ...overrides,
    },
  };
}

describe("canonicalizeEntry", () => {
  it("should canonicalize ingredients and cookware against both registries", () => {
    const result = canonicalizeEntry(makeEntry(), ontologies);

    expect(
      result.entry.predicted.ingredientGroups[0]?.items[0]?.ingredient,
    ).toBe("chicken-breast");
    expect(result.entry.predicted.cookware).toEqual(["frying pan"]);
    expect(result.decisions).toHaveLength(1);
    expect(result.cookwareDecisions).toHaveLength(1);
  });
});

describe("countUnresolved", () => {
  it("should count only unresolved decisions that still have candidates", () => {
    const decisions = [
      { method: "none", candidates: [{ slug: "garlic", score: 0.5 }] },
      { method: "none", candidates: [] },
      { method: "exact", candidates: [{ slug: "garlic", score: 1 }] },
    ];
    expect(countUnresolved(decisions)).toBe(1);
  });
});

describe("countResolvedByLlm", () => {
  it("should count decisions the LLM resolved", () => {
    expect(
      countResolvedByLlm([{ method: "llm" }, { method: "exact" }, { method: "llm" }]),
    ).toBe(2);
  });
});

describe("withRetries", () => {
  const policy = {
    max_retries: 2,
    retry_base_delay_ms: 1,
    retry_max_delay_ms: 2,
  };

  it("should return the first successful result", async () => {
    const call = vi.fn().mockResolvedValue("ok");
    await expect(withRetries("label", policy, call)).resolves.toBe("ok");
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("should retry until the call succeeds", async () => {
    const call = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue("ok");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(withRetries("label", policy, call)).resolves.toBe("ok");

    expect(call).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("should give up after exhausting the retries", async () => {
    const call = vi.fn().mockRejectedValue(new Error("boom"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(withRetries("label", policy, call)).resolves.toBeUndefined();

    expect(call).toHaveBeenCalledTimes(policy.max_retries + 1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("failed for label after 3 attempt(s)"),
    );
    warn.mockRestore();
  });
});

describe("disambiguateEntry", () => {
  const ingredientCategories = new Map([["bell-pepper", "vegetable"]]);
  const equipmentCategories = new Map([["baking-tray", "bakeware"]]);

  function unresolvedCanonicalization(): EntryCanonicalization {
    return {
      entry: makeEntry({
        ingredientGroups: [{ items: [{ ingredient: "pepper", amount: 1 }] }],
        cookware: ["oven thing"],
      }),
      decisions: [
        {
          originalSlug: "pepper",
          baseSlug: "pepper",
          canonicalSlug: "pepper",
          method: "none",
          reason: "below-threshold",
          candidates: [{ slug: "bell-pepper", score: 0.7 }],
        },
      ],
      cookwareDecisions: [
        {
          originalName: "oven thing",
          baseSlug: "oven-thing",
          canonicalSlug: "oven-thing",
          method: "none",
          reason: "below-threshold",
          candidates: [{ slug: "baking-tray", score: 0.6 }],
        },
      ],
    };
  }

  it("should apply both resolvers and fold the choices into the entry", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await disambiguateEntry(unresolvedCanonicalization(), {
      ingredientCategories,
      equipmentCategories,
      resolveIngredients: async ({ unresolvedItems, recipeContext }) => {
        expect(unresolvedItems[0]?.candidates[0]).toEqual({
          slug: "bell-pepper",
          category: "vegetable",
        });
        expect(recipeContext.title).toBe("Chicken Traybake");
        return [
          {
            slug: "pepper",
            canonicalSlug: "bell-pepper",
            confidence: "high",
          },
        ];
      },
      resolveEquipment: async ({ unresolvedItems, equipmentContext }) => {
        expect(unresolvedItems[0]?.slug).toBe("oven-thing");
        expect(equipmentContext.instructions).toEqual(["Roast everything."]);
        return [
          {
            slug: "oven-thing",
            canonicalSlug: "baking-tray",
            confidence: "medium",
          },
        ];
      },
    });

    expect(
      result.entry.predicted.ingredientGroups[0]?.items[0]?.ingredient,
    ).toBe("bell-pepper");
    expect(result.entry.predicted.cookware).toEqual(["baking tray"]);
    expect(result.decisions[0]?.method).toBe("llm");
    expect(result.cookwareDecisions[0]?.method).toBe("llm");
    log.mockRestore();
  });

  it("should keep deterministic results when a resolver returns nothing", async () => {
    const result = await disambiguateEntry(unresolvedCanonicalization(), {
      ingredientCategories,
      equipmentCategories,
      resolveIngredients: async () => undefined,
      resolveEquipment: async () => undefined,
    });

    expect(
      result.entry.predicted.ingredientGroups[0]?.items[0]?.ingredient,
    ).toBe("pepper");
    expect(result.entry.predicted.cookware).toEqual(["oven thing"]);
    expect(result.decisions[0]?.method).toBe("none");
    expect(result.cookwareDecisions[0]?.method).toBe("none");
  });

  it("should skip resolvers when nothing is unresolved", async () => {
    const resolveIngredients = vi.fn();
    const resolveEquipment = vi.fn();

    await disambiguateEntry(canonicalizeEntry(makeEntry(), ontologies), {
      ingredientCategories,
      equipmentCategories,
      resolveIngredients,
      resolveEquipment,
    });

    expect(resolveIngredients).not.toHaveBeenCalled();
    expect(resolveEquipment).not.toHaveBeenCalled();
  });
});

describe("disambiguateEntries", () => {
  it("should only resolve entries that have unresolved items", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const resolved = canonicalizeEntry(makeEntry(), ontologies);
    const unresolved = canonicalizeEntry(
      makeEntry({ cookware: ["roasting tray"] }),
      ontologies,
    );

    const resolveEquipment = vi.fn().mockResolvedValue([
      {
        slug: "roasting-tray",
        canonicalSlug: "baking-tray",
        confidence: "high",
      },
    ]);

    const results = await disambiguateEntries([resolved, unresolved], {
      ingredientCategories: new Map(),
      equipmentCategories: new Map([["baking-tray", "bakeware"]]),
      resolveIngredients: vi.fn(),
      resolveEquipment,
    });

    expect(results[0]).toBe(resolved);
    expect(results[1]?.entry.predicted.cookware).toEqual(["baking tray"]);
    expect(resolveEquipment).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("LLM resolved 0 of 0 ingredient(s) and 1 of 1"),
    );
    log.mockRestore();
  });
});
