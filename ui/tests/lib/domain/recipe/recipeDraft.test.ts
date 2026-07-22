import { CooklangParser } from "@cooklang/cooklang";
import { describe, expect, it } from "vitest";
import {
  buildRecipeDraft,
  normalizeRecipeSource,
  parseSavedRecipePayload,
  savedRecipeCard,
} from "@/lib/domain/recipe/recipeDraft";

describe("normalizeRecipeSource", () => {
  it("preserves one continuous inline Cooklang recipe", () => {
    const source = "  Mix @flour{200%g} in a #bowl{} for ~{2%minutes}.  ";
    expect(normalizeRecipeSource(source)).toBe(
      "Mix @flour{200%g} in a #bowl{} for ~{2%minutes}.",
    );
  });
});

describe("buildRecipeDraft", () => {
  it("preserves comma-separated cuisine labels as distinct values", () => {
    const source = "@rice{200%g}\n\nCook the rice.";
    const [parsed] = new CooklangParser().parse(source);

    const draft = buildRecipeDraft(
      parsed,
      {
        title: "Italian-American Rice",
        description: "A fusion rice dish.",
        cuisine: "Italian, American",
        servings: 2,
      },
      source,
    );

    expect(draft.cuisine).toEqual(["Italian", "American"]);
  });
});

describe("savedRecipeCard", () => {
  const savedPayload = {
    version: 1 as const,
    source: "Cook @rice{200%g}.",
    recipe: {
      title: "Weeknight Rice",
      description: "A quick dinner.",
      date: "2026-07-22",
      canonical: "https://example.test/weeknight-rice",
      cuisine: [],
      servings: 2,
      tags: [],
      image: "recipes/weeknight-rice-2026-07-22",
      imageAlt: "A bowl of rice",
      ingredientGroups: [
        {
          items: [{ ingredient: "rice", amount: 200, unit: "g" }],
        },
      ],
      instructions: ["Cook the rice."],
      cookware: [],
      cookBody: "Cook @rice{200%g}.",
    },
  };

  function record(visibility: "public" | "private" | "household") {
    return {
      slug: "weeknight-rice",
      title: "Weeknight Rice",
      description: "A quick dinner.",
      body: JSON.stringify(savedPayload),
      visibility,
      createdAt: "2026-07-22T12:00:00.000Z",
      updatedAt: "2026-07-22T12:00:00.000Z",
    };
  }

  it("uses the indexable route for public recipes", () => {
    expect(savedRecipeCard(record("public"))).toMatchObject({
      href: "/recipes/weeknight-rice",
      image: "recipes/weeknight-rice-2026-07-22",
      imageAlt: "A bowl of rice",
      canonical: "https://example.test/weeknight-rice",
    });
  });

  it.each(["private", "household"] as const)(
    "uses the authenticated route for %s recipes",
    (visibility) => {
      expect(savedRecipeCard(record(visibility))?.href).toBe(
        "/recipes/saved?slug=weeknight-rice",
      );
    },
  );

  it("parses the source and recipe needed by the editor", () => {
    expect(parseSavedRecipePayload(record("private"))).toEqual(savedPayload);
  });

  it("preserves the canonical source URL in saved recipe views", () => {
    expect(savedRecipeCard(record("private"))?.canonical).toBe(
      "https://example.test/weeknight-rice",
    );
  });

  it.each([null, "{", JSON.stringify({ version: 1, recipe: {} })])(
    "rejects an unsupported saved payload: %s",
    (body) => {
      expect(
        parseSavedRecipePayload({ ...record("private"), body }),
      ).toBeNull();
    },
  );
});
