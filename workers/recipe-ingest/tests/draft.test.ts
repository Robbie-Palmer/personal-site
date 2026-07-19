import { describe, expect, it } from "vitest";
import { buildFinalDraft } from "../src/draft";

describe("buildFinalDraft", () => {
  it("serializes the finalized recipe into the editable Cooklang source", () => {
    const draft = buildFinalDraft(
      ["imports/job/source/1.jpg"],
      {
        title: "Pepper Pasta",
        description: "A quick pasta.",
        cuisine: ["Italian"],
        servings: 2,
        prepTime: 10,
        cookTime: 20,
        ingredientGroups: [
          {
            items: [
              { ingredient: "bell-pepper", amount: 1, unit: "piece" },
            ],
          },
        ],
        instructions: ["Cook the pepper with the pasta."],
        cookware: ["frying pan"],
      },
      ["Normalization used a deterministic fallback."],
    );

    expect(draft.cooklang.body).toContain("@bell pepper{1%piece}");
    expect(draft.cooklang.body).not.toContain("@capsicum");
    expect(draft.cooklang.frontmatter.cuisine).toEqual(["Italian"]);
    expect(draft.cooklang.diagnostics).toEqual([
      "Normalization used a deterministic fallback.",
    ]);
    expect(draft.recipe.ingredientGroups[0]?.items[0]?.ingredient).toBe(
      "bell-pepper",
    );
  });
});
