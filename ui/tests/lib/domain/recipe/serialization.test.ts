import {
  escapeHtmlAttribute,
  escapeHtmlText,
  formatRecipeCooklang,
  formatRecipeMarkdown,
} from "recipe-domain/serialization";
import { describe, expect, it } from "vitest";

const recipe = {
  title: "Soup & Stew",
  description: "A useful dinner.",
  date: "2026-07-22",
  cuisine: ["Irish"],
  servings: 2,
  prepTime: 5,
  cookTime: 20,
  tags: ["dinner"],
  ingredientGroups: [
    {
      items: [
        {
          ingredient: "red-onion",
          amount: 2,
          unit: "piece" as const,
          preparation: "diced",
          note: "small",
        },
      ],
    },
  ],
  instructions: ["Cook it."],
  cookware: ["pot"],
  cookBody: "Cook @red onion{2} in a #pot{}.",
};

describe("recipe serialization", () => {
  it("uses a shared complete Markdown representation", () => {
    const markdown = formatRecipeMarkdown(recipe);

    expect(markdown).toContain("# Soup & Stew");
    expect(markdown).toContain("- 2 red onions (diced) – small");
    expect(markdown).toContain("## Cookware\n\n- pot");
  });

  it("uses a shared Cooklang representation with annotations", () => {
    const cooklang = formatRecipeCooklang(recipe);

    expect(cooklang).toContain('title: "Soup & Stew"');
    expect(cooklang).toContain(
      'ingredientAnnotations: {"red-onion":{"preparation":"diced","note":"small"}}',
    );
    expect(cooklang.endsWith("Cook @red onion{2} in a #pot{}.\n")).toBe(true);
  });

  it("uses context-specific entity escaping", () => {
    expect(escapeHtmlText(`<Soup> & "stew"`)).toBe(`&lt;Soup&gt; &amp; "stew"`);
    expect(escapeHtmlAttribute(`<Soup> & "stew"`)).toBe(
      "&lt;Soup&gt; &amp; &quot;stew&quot;",
    );
  });
});
