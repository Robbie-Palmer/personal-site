import { isRecord } from "recipe-domain/validation";
import {
  isRecipeVisibility,
  RECIPE_VISIBILITIES,
  RecipeVisibilitySchema,
} from "recipe-domain/visibility";
import { describe, expect, it } from "vitest";

describe("shared recipe primitives", () => {
  it("accepts plain records without treating arrays as records", () => {
    expect(isRecord({ recipe: "soup" })).toBe(true);
    expect(isRecord(Object.create(null))).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });

  it("keeps recipe visibility values and validation together", () => {
    expect(RECIPE_VISIBILITIES).toEqual(["public", "private", "household"]);
    for (const visibility of RECIPE_VISIBILITIES) {
      expect(RecipeVisibilitySchema.parse(visibility)).toBe(visibility);
      expect(isRecipeVisibility(visibility)).toBe(true);
    }
    expect(RecipeVisibilitySchema.safeParse("shared").success).toBe(false);
    expect(isRecipeVisibility("shared")).toBe(false);
  });
});
