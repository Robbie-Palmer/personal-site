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
});
