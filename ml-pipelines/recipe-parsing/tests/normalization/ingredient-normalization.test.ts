import { describe, expect, it } from "vitest";
import {
  canonicalizeIngredientSlug,
  normalizeIngredientSlug,
  normalizePredictionEntry,
} from "../../src/lib/ingredient-normalization.js";

describe("normalizeIngredientSlug", () => {
  it("should do baseline slug normalization", () => {
    expect(normalizeIngredientSlug("Chicken Breasts")).toBe("chicken-breasts");
    expect(normalizeIngredientSlug("Parmesan Cheese")).toBe("parmesan-cheese");
    expect(normalizeIngredientSlug("salt and pepper")).toBe("salt-and-pepper");
  });
});

describe("canonicalizeIngredientSlug", () => {
  it("should match typo against local ontology with fuzzy-local", () => {
    const decision = canonicalizeIngredientSlug({
      rawSlug: "garlic-clov",
      localOntology: new Set(["garlic"]),
      globalOntology: new Set(["garlic", "garlic-clove"]),
    });
    expect(decision.normalizedSlug).toBe("garlic");
    expect(decision.method).toMatch(/local/);
  });

  it("should keep unknown if below strict threshold", () => {
    const decision = canonicalizeIngredientSlug({
      rawSlug: "salt-and-pepper",
      localOntology: new Set(["black-pepper"]),
      globalOntology: new Set(["black-pepper", "salt"]),
    });
    expect(decision.method).toBe("none");
    expect(decision.normalizedSlug).toBe("salt-and-pepper");
  });

  it("should apply safe deterministic cleanup rules", () => {
    const baconDecision = canonicalizeIngredientSlug({
      rawSlug: "slices-of-bacon",
      localOntology: new Set(["bacon"]),
      globalOntology: new Set(["bacon"]),
    });
    expect(baconDecision.normalizedSlug).toBe("bacon");

    const milkDecision = canonicalizeIngredientSlug({
      rawSlug: "semi-skimmed-milk",
      localOntology: new Set(["milk"]),
      globalOntology: new Set(["milk"]),
    });
    expect(milkDecision.normalizedSlug).toBe("milk");

    const redPepperDecision = canonicalizeIngredientSlug({
      rawSlug: "red-pepper",
      localOntology: new Set(["bell-pepper"]),
      globalOntology: new Set(["bell-pepper"]),
    });
    expect(redPepperDecision.normalizedSlug).toBe("bell-pepper");

    const yellowPepperDecision = canonicalizeIngredientSlug({
      rawSlug: "yellow-pepper",
      localOntology: new Set(["bell-pepper"]),
      globalOntology: new Set(["bell-pepper"]),
    });
    expect(yellowPepperDecision.normalizedSlug).toBe("bell-pepper");

    const greenPepperDecision = canonicalizeIngredientSlug({
      rawSlug: "green-pepper",
      localOntology: new Set(["bell-pepper"]),
      globalOntology: new Set(["bell-pepper"]),
    });
    expect(greenPepperDecision.normalizedSlug).toBe("bell-pepper");

    const sausageDecision = canonicalizeIngredientSlug({
      rawSlug: "sausages",
      localOntology: new Set(["pork-sausage"]),
      globalOntology: new Set(["pork-sausage"]),
    });
    expect(sausageDecision.normalizedSlug).toBe("pork-sausage");

    const onionDecision = canonicalizeIngredientSlug({
      rawSlug: "onion",
      localOntology: new Set(["white-onion"]),
      globalOntology: new Set(["white-onion"]),
    });
    expect(onionDecision.normalizedSlug).toBe("white-onion");

    const mediumOnionDecision = canonicalizeIngredientSlug({
      rawSlug: "medium-onion",
      localOntology: new Set(["white-onion"]),
      globalOntology: new Set(["white-onion"]),
    });
    expect(mediumOnionDecision.normalizedSlug).toBe("white-onion");
  });

  it("should use pluralization normalization when ontology has singular form", () => {
    const onionDecision = canonicalizeIngredientSlug({
      rawSlug: "onions",
      localOntology: new Set(["onion"]),
      globalOntology: new Set(["onion"]),
    });
    expect(onionDecision.normalizedSlug).toBe("onion");

    const garlicDecision = canonicalizeIngredientSlug({
      rawSlug: "garlic-cloves",
      localOntology: new Set(["garlic"]),
      globalOntology: new Set(["garlic"]),
    });
    expect(garlicDecision.normalizedSlug).toBe("garlic");
  });
});

describe("normalizePredictionEntry", () => {
  it("should normalize ingredient slugs inside ingredient groups", () => {
    const normalized = normalizePredictionEntry({
      images: ["a.jpg"],
      predicted: {
        title: "x",
        description: "y",
        servings: 2,
        ingredientGroups: [
          {
            items: [
              { ingredient: "chicken-fillets", amount: 2, unit: "piece" },
              { ingredient: "garlic-clove", amount: 1, unit: "clove" },
            ],
          },
        ],
        instructions: ["step"],
      },
    }, {
      local: new Set(["chicken-breast", "garlic"]),
      global: new Set(["chicken-breast", "garlic"]),
    });

    expect(
      normalized.entry.predicted.ingredientGroups[0]?.items.map((i) => i.ingredient),
    ).toEqual(["chicken-breast", "garlic"]);
  });

  it("should normalize cuisine labels by stripping trailing hyphen qualifiers", () => {
    const normalized = normalizePredictionEntry({
      images: ["a.jpg"],
      predicted: {
        title: "x",
        description: "y",
        cuisine: "Italian-American",
        servings: 2,
        ingredientGroups: [{ items: [{ ingredient: "garlic", amount: 1 }] }],
        instructions: ["step"],
      },
    }, {
      local: new Set(["garlic"]),
      global: new Set(["garlic"]),
    });

    expect(normalized.entry.predicted.cuisine).toBe("Italian");
  });
});
