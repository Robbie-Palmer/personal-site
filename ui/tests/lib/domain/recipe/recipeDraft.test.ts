import { CooklangParser } from "@cooklang/cooklang";
import { describe, expect, it } from "vitest";
import {
  buildRecipeDraft,
  normalizeRecipeSource,
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
