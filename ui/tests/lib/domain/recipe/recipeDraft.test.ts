import { describe, expect, it } from "vitest";
import { normalizeRecipeSource } from "@/lib/domain/recipe/recipeDraft";

describe("normalizeRecipeSource", () => {
  it("preserves one continuous inline Cooklang recipe", () => {
    const source = "  Mix @flour{200%g} in a #bowl{} for ~{2%minutes}.  ";
    expect(normalizeRecipeSource(source)).toBe(
      "Mix @flour{200%g} in a #bowl{} for ~{2%minutes}.",
    );
  });
});
