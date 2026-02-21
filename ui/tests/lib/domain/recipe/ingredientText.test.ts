import { describe, expect, it } from "vitest";
import {
  formatIngredientName,
  pluralizeIngredientName,
} from "@/lib/domain/recipe/ingredientText";

describe("ingredientText", () => {
  describe("pluralizeIngredientName", () => {
    it("uses pluralName override when provided", () => {
      expect(
        pluralizeIngredientName({
          name: "leaf",
          pluralName: "leaves",
        }),
      ).toBe("leaves");
    });

    it("pluralizes regular ingredient names", () => {
      expect(
        pluralizeIngredientName({
          name: "white onion",
        }),
      ).toBe("white onions");
    });

    it("keeps configured uncountable names unchanged", () => {
      expect(
        pluralizeIngredientName({
          name: "milk",
        }),
      ).toBe("milk");
    });

    it("does not over-pluralize already plural ingredient names", () => {
      expect(
        pluralizeIngredientName({
          name: "chips",
        }),
      ).toBe("chips");
    });
  });

  describe("formatIngredientName", () => {
    it("keeps singular form at exactly one piece", () => {
      expect(
        formatIngredientName(
          {
            name: "white onion",
            unit: "piece",
            amount: 1,
          },
          1,
        ),
      ).toBe("white onion");
    });

    it("singularizes already-plural ingredient names at one piece", () => {
      expect(
        formatIngredientName(
          {
            name: "pork sausages",
            unit: "piece",
            amount: 1,
          },
          1,
        ),
      ).toBe("pork sausage");
    });

    it("pluralizes for fractional piece amounts", () => {
      expect(
        formatIngredientName(
          {
            name: "white onion",
            unit: "piece",
            amount: 1,
          },
          0.5,
        ),
      ).toBe("white onions");
    });

    it("pluralizes for zero piece amounts", () => {
      expect(
        formatIngredientName(
          {
            name: "white onion",
            unit: "piece",
            amount: 0,
          },
          1,
        ),
      ).toBe("white onions");
    });
  });
});
