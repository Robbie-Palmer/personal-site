import { describe, expect, it } from "vitest";
import { formatIngredient } from "@/lib/domain/recipe/ingredientDisplay";
import { preferenceForSystem } from "@/lib/domain/recipe/unit";

const tinnedTomatoes = {
  ingredient: "chopped-tomatoes",
  name: "chopped tomatoes",
  amount: 1,
  unit: "tin" as const,
  note: "400g",
};

describe("formatIngredient", () => {
  it("converts measurement-only annotations with the selected units", () => {
    expect(formatIngredient(tinnedTomatoes, 1, preferenceForSystem("us"))).toBe(
      "1 tin of chopped tomatoes – 14 oz",
    );
  });

  it("leaves prose annotations unchanged", () => {
    expect(
      formatIngredient(
        { ...tinnedTomatoes, note: "drained weight 400g" },
        1,
        preferenceForSystem("us"),
      ),
    ).toBe("1 tin of chopped tomatoes – drained weight 400g");
  });
});
