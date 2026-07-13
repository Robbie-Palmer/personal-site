import { describe, expect, it } from "vitest";
import { safeRecipeReturnPath } from "@/lib/generic/safe-return-path";

const ORIGIN = "https://recipes.example.test";

describe("safeRecipeReturnPath", () => {
  it("keeps same-origin recipe paths, queries, and fragments", () => {
    expect(
      safeRecipeReturnPath("/recipes/onboarding?step=box#choices", ORIGIN),
    ).toBe("/recipes/onboarding?step=box#choices");
  });

  it.each([
    null,
    "https://attacker.example/recipes/onboarding",
    "//attacker.example/recipes/onboarding",
    "/recipes/../attacker.example",
    "/recipes/..//attacker.example",
    "/projects/recipe-site",
  ])("rejects unsafe return target %s", (value) => {
    expect(safeRecipeReturnPath(value, ORIGIN)).toBeNull();
  });
});
