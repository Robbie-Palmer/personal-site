import { CooklangParser } from "@cooklang/cooklang";
import { describe, expect, it } from "vitest";
import { buildScaledRecipeParts } from "@/lib/domain/recipe/cooklangTransform";

const parser = new CooklangParser();

function parsedAt(body: string, scale?: number) {
  const [recipe] = parser.parse(body, scale);
  return recipe;
}

describe("buildScaledRecipeParts", () => {
  it("returns base amounts when parsed without a scale", () => {
    const parts = buildScaledRecipeParts(
      parsedAt(`Add @flour{200%g} to the #bowl{}.\n`),
    );

    expect(parts.ingredientGroups).toEqual([
      { items: [{ ingredient: "flour", amount: 200, unit: "g" }] },
    ]);
    expect(parts.instructions).toEqual(["Add 200g of flour to the bowl."]);
  });

  it("propagates cooklang-rs scaling to ingredient groups and instructions", () => {
    const parts = buildScaledRecipeParts(
      parsedAt(`Add @flour{200%g} and @sugar{100%g} to the #bowl{}.\n`, 2),
    );

    expect(parts.ingredientGroups).toEqual([
      {
        items: [
          { ingredient: "flour", amount: 400, unit: "g" },
          { ingredient: "sugar", amount: 200, unit: "g" },
        ],
      },
    ]);
    expect(parts.instructions).toEqual([
      "Add 400g of flour and 200g of sugar to the bowl.",
    ]);
  });

  it("honours the = fixed-quantity prefix when scaling", () => {
    const parts = buildScaledRecipeParts(
      parsedAt(`Mix @flour{200%g} with @salt{=1%tsp}.\n`, 3),
    );

    const items = parts.ingredientGroups[0]?.items ?? [];
    const flour = items.find((i) => i.ingredient === "flour");
    const salt = items.find((i) => i.ingredient === "salt");
    expect(flour).toEqual({ ingredient: "flour", amount: 600, unit: "g" });
    expect(salt).toEqual({ ingredient: "salt", amount: 1, unit: "tsp" });
    expect(parts.instructionSdk.ingredientAmounts).toEqual([600, 1]);
  });

  it("applies frontmatter annotations to scaled ingredient groups", () => {
    const parts = buildScaledRecipeParts(
      parsedAt(`Slice @red onion{1}.\n`, 2),
      { "red-onion": { preparation: "finely chopped", note: "large" } },
    );

    expect(parts.ingredientGroups[0]?.items).toEqual([
      {
        ingredient: "red-onion",
        amount: 2,
        preparation: "finely chopped",
        note: "large",
      },
    ]);
  });

  it("maps cooklang-rs short unit forms back to UnitSchema names when scaling", () => {
    // cooklang-rs normalises `cup` to `c` whenever a scale parameter is
    // supplied to parse() — even at scale=1. The explicit regional variants
    // (us_cup, uk_cup…) are not known to cooklang-rs so they pass through
    // unchanged, which makes the normaliser reliable for those tokens.
    const parts = buildScaledRecipeParts(
      parsedAt(`@mayonnaise{0.5%us_cup}\n`, 1),
    );

    expect(parts.ingredientGroups[0]?.items).toEqual([
      { ingredient: "mayonnaise", amount: 0.5, unit: "us_cup" },
    ]);
    expect(parts.instructionSdk.ingredientUnits).toEqual(["us_cup"]);
  });

  it("preserves the user's written unit when cooklang-rs converts it", () => {
    // cooklang-rs converts uk_pint → c using US ratios the moment any scale
    // is passed. With the unit-recovery reference parse the transform restores
    // the written unit instead.
    const body = `@milk{1%uk_pint}\n`;
    const parsedOriginal = parsedAt(body);
    const parts = buildScaledRecipeParts(
      parsedAt(body, 3),
      {},
      {
        parsedOriginal,
        scale: 3,
      },
    );

    expect(parts.ingredientGroups[0]?.items).toEqual([
      { ingredient: "milk", amount: 3, unit: "uk_pint" },
    ]);
    expect(parts.instructionSdk.ingredientUnits).toEqual(["uk_pint"]);
    expect(parts.instructionSdk.ingredientAmounts).toEqual([3]);
  });

  it("preserves tsp when cooklang-rs would consolidate it into tbsp at scale", () => {
    // cooklang-rs leaves tsp alone at small scales but consolidates to tbsp
    // once the value gets large enough. Without the unit-recovery reference
    // parse, the same recipe would render in tsp at one scale and tbsp at
    // the next, which is confusing across recipe iterations.
    const body = `Add @cajun seasoning{4%tsp}.\n`;
    const parsedOriginal = parsedAt(body);
    const parts = buildScaledRecipeParts(
      parsedAt(body, 1.5),
      {},
      {
        parsedOriginal,
        scale: 1.5,
      },
    );

    expect(parts.ingredientGroups[0]?.items).toEqual([
      { ingredient: "cajun-seasoning", amount: 6, unit: "tsp" },
    ]);
    expect(parts.instructions).toEqual(["Add 6 tsp of cajun seasoning."]);
  });

  it("trusts cooklang for fixed-quantity ingredients (= prefix is no-op for unit conversion)", () => {
    // The recovery branch only fires when units differ; cooklang preserves
    // both unit and amount for `=` ingredients, so we should pass them through.
    const body = `Mix @flour{200%g} with @salt{=1%uk_pint}.\n`;
    const parsedOriginal = parsedAt(body);
    const parts = buildScaledRecipeParts(
      parsedAt(body, 3),
      {},
      {
        parsedOriginal,
        scale: 3,
      },
    );

    const items = parts.ingredientGroups[0]?.items ?? [];
    expect(items.find((i) => i.ingredient === "flour")).toEqual({
      ingredient: "flour",
      amount: 600,
      unit: "g",
    });
    expect(items.find((i) => i.ingredient === "salt")).toEqual({
      ingredient: "salt",
      amount: 1,
      unit: "uk_pint",
    });
  });
});
