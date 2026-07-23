import { describe, expect, it } from "vitest";
import {
  buildOntology,
  buildOntologyIndex,
  matchSlug,
} from "../../src/lib/slug-matching.js";

describe("buildOntology", () => {
  it("should collect slugs", () => {
    const ontology = buildOntology(
      [{ slug: "garlic" }, { slug: "onion" }],
      "ingredient",
    );
    expect([...ontology]).toEqual(["garlic", "onion"]);
  });

  it("should reject duplicate slugs", () => {
    expect(() =>
      buildOntology([{ slug: "garlic" }, { slug: "garlic" }], "ingredient"),
    ).toThrow("Duplicate canonical ingredient slug: garlic");
  });
});

describe("matchSlug", () => {
  const ontology = new Set(["frying-pan", "griddle-pan", "baking-tray"]);
  const ontologyIndex = buildOntologyIndex(ontology);

  it("should prefer an exact candidate over fuzzy scoring", () => {
    const match = matchSlug({
      baseSlug: "skillet",
      candidateSlugs: ["skillet", "frying-pan"],
      ontology,
      ontologyIndex,
    });
    expect(match).toMatchObject({
      canonicalSlug: "frying-pan",
      method: "exact",
      score: 1,
      threshold: 1,
    });
  });

  it("should accept a fuzzy match that clears the threshold and margin", () => {
    const match = matchSlug({
      baseSlug: "fryingpan",
      candidateSlugs: ["fryingpan"],
      ontology,
      ontologyIndex,
      fuzzyThreshold: 0.3,
      fuzzyMargin: 0.05,
    });
    expect(match.method).toBe("fuzzy");
    expect(match.canonicalSlug).toBe("frying-pan");
    expect(match.margin).toBeGreaterThanOrEqual(0.05);
  });

  it("should refuse a top match that does not beat the runner-up by the margin", () => {
    const match = matchSlug({
      baseSlug: "pan",
      candidateSlugs: ["pan"],
      ontology,
      ontologyIndex,
      fuzzyThreshold: 0.1,
      fuzzyMargin: 0.5,
    });
    expect(match).toMatchObject({
      canonicalSlug: "pan",
      method: "none",
      reason: "ambiguous",
    });
    expect(match.margin).toBeLessThan(0.5);
  });

  it("should report a below-threshold near miss with its candidates", () => {
    const match = matchSlug({
      baseSlug: "tagine",
      candidateSlugs: ["tagine"],
      ontology,
      ontologyIndex,
    });
    expect(match.method).toBe("none");
    expect(match.reason).toBe("below-threshold");
    expect(match.candidates.length).toBeGreaterThan(0);
  });

  it("should report no candidates against an empty ontology", () => {
    const match = matchSlug({
      baseSlug: "tagine",
      candidateSlugs: ["tagine"],
      ontology: new Set(),
    });
    expect(match).toMatchObject({
      canonicalSlug: "tagine",
      method: "none",
      reason: "no-candidates",
      candidates: [],
    });
  });

  it("should shortlist by length when no token is shared", () => {
    const match = matchSlug({
      baseSlug: "wok",
      candidateSlugs: ["wok"],
      ontology: new Set(["pot", "jug"]),
      fuzzyThreshold: 0.1,
      fuzzyMargin: 0,
    });
    expect(match.candidates.map((c) => c.slug).sort()).toEqual(["jug", "pot"]);
  });
});
