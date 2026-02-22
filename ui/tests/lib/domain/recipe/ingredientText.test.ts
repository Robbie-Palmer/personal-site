import { describe, expect, it } from "vitest";
import {
  formatIngredientName,
  initIngredientPluralizeRules,
  pluralizeIngredientName,
} from "@/lib/domain/recipe/ingredientText";

describe("ingredientText", () => {
  describe("pluralizeIngredientName", () => {
    it("initialization is idempotent", () => {
      expect(() => initIngredientPluralizeRules()).not.toThrow();
      expect(() => initIngredientPluralizeRules()).not.toThrow();
      expect(
        pluralizeIngredientName({
          name: "milk",
        }),
      ).toBe("milk");
    });

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
    it("returns name unchanged for non-piece units", () => {
      expect(
        formatIngredientName(
          {
            name: "white onion",
            unit: "g",
            amount: 200,
          },
          1,
        ),
      ).toBe("white onion");
    });

    it("returns name unchanged for piece unit with undefined amount", () => {
      expect(
        formatIngredientName(
          {
            name: "white onion",
            unit: "piece",
          },
          1,
        ),
      ).toBe("white onion");
    });

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

    it("uses pluralName override for plural piece amounts", () => {
      expect(
        formatIngredientName(
          {
            name: "pork sausage",
            pluralName: "pork sausages (custom)",
            unit: "piece",
            amount: 2,
          },
          1,
        ),
      ).toBe("pork sausages (custom)");
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
