import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PredictionEntry } from "recipe-parsing/schemas/ground-truth";

const { disambiguateIngredients, disambiguateEquipment } = vi.hoisted(() => ({
  disambiguateIngredients: vi.fn(),
  disambiguateEquipment: vi.fn(),
}));

vi.mock("recipe-parsing/openrouter", () => ({
  disambiguateIngredients,
  disambiguateEquipment,
}));

const { canonicalizePredictions } = await import(
  "../../src/lib/canonicalization.js"
);

const canonicalizeParams = {
  model: "test-model",
  request_timeout_ms: 1000,
  max_retries: 0,
  concurrency: 1,
  retry_base_delay_ms: 1,
  retry_max_delay_ms: 2,
};

function predictions(): { entries: PredictionEntry[] } {
  return {
    entries: [
      {
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
          cookware: ["large skillet", "pizza pan"],
        },
      },
    ],
  };
}

describe("canonicalizePredictions", () => {
  beforeEach(() => {
    disambiguateIngredients.mockReset();
    disambiguateEquipment.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("should canonicalize deterministically when no API key is available", async () => {
    const result = await canonicalizePredictions({
      predictions: predictions(),
      canonicalizeParams,
    });

    const entry = result.canonicalized.entries[0]!;
    expect(entry.predicted.ingredientGroups[0]?.items[0]?.ingredient).toBe(
      "chicken-breast",
    );
    expect(entry.predicted.cookware).toEqual(["frying pan", "pizza pan"]);
    expect(result.decisions.entries[0]?.images).toEqual(["a.jpg"]);
    expect(result.decisions.entries[0]?.cookwareDecisions).toHaveLength(2);
    expect(disambiguateEquipment).not.toHaveBeenCalled();
  });

  it("should skip the LLM pass when the stage has no params", async () => {
    await canonicalizePredictions({
      predictions: predictions(),
      apiKey: "key",
    });

    expect(disambiguateIngredients).not.toHaveBeenCalled();
    expect(disambiguateEquipment).not.toHaveBeenCalled();
  });

  it("should apply LLM choices for unresolved equipment", async () => {
    let chosen = "";
    disambiguateEquipment.mockImplementation(({ unresolvedItems }) => {
      const item = unresolvedItems[0];
      chosen = item.candidates[0].slug;
      return Promise.resolve({
        value: [
          {
            slug: item.slug,
            canonicalSlug: chosen,
            confidence: "medium",
          },
        ],
      });
    });

    const result = await canonicalizePredictions({
      predictions: predictions(),
      canonicalizeParams,
      apiKey: "key",
    });

    expect(disambiguateEquipment).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "key",
        model: "test-model",
        requestTimeoutMs: 1000,
      }),
    );
    expect(result.canonicalized.entries[0]?.predicted.cookware).toEqual([
      "frying pan",
      chosen.replace(/-/g, " "),
    ]);
    expect(
      result.decisions.entries[0]?.cookwareDecisions[1]?.method,
    ).toBe("llm");
  });

  it("should apply LLM choices for unresolved ingredients", async () => {
    let chosen = "";
    disambiguateIngredients.mockImplementation(({ unresolvedItems }) => {
      const item = unresolvedItems[0];
      chosen = item.candidates[0].slug;
      return Promise.resolve({
        value: [
          { slug: item.slug, canonicalSlug: chosen, confidence: "low" },
        ],
      });
    });
    disambiguateEquipment.mockResolvedValue({ value: [] });

    const withUnknownIngredient = predictions();
    withUnknownIngredient.entries[0]!.predicted.ingredientGroups = [
      { items: [{ ingredient: "miso-paste", amount: 1 }] },
    ];

    const result = await canonicalizePredictions({
      predictions: withUnknownIngredient,
      canonicalizeParams,
      apiKey: "key",
    });

    expect(disambiguateIngredients).toHaveBeenCalledWith(
      expect.objectContaining({ model: "test-model" }),
    );
    expect(
      result.canonicalized.entries[0]?.predicted.ingredientGroups[0]?.items[0]
        ?.ingredient,
    ).toBe(chosen);
  });

  it("should keep deterministic results when the LLM call keeps failing", async () => {
    disambiguateEquipment.mockRejectedValue(new Error("provider down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await canonicalizePredictions({
      predictions: predictions(),
      canonicalizeParams,
      apiKey: "key",
    });

    expect(result.canonicalized.entries[0]?.predicted.cookware).toEqual([
      "frying pan",
      "pizza pan",
    ]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('equipment in "Chicken Traybake"'),
    );
    warn.mockRestore();
  });
});
