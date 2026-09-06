import {
  isRecipeVisibility,
  RECIPE_VISIBILITIES,
  RecipeVisibilitySchema,
} from "recipe-domain/visibility";
import { describe, expect, it } from "vitest";

describe("shared recipe primitives", () => {
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
