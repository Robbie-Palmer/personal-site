import { describe, expect, it } from "vitest";
import { tokenizeInstructionSdk } from "@/lib/domain/recipe/instructionTokens";
import type { RecipeInstructionSdk } from "@/lib/domain/recipe/recipe";

function makeSdk(
  overrides: Partial<RecipeInstructionSdk> = {},
): RecipeInstructionSdk {
  return {
    ingredientNames: ["onion"],
    ingredientDisplayValues: ["red onion"],
    cookwareDisplayValues: ["oven"],
    timerDisplayValues: ["10 min"],
    sections: [
      {
        name: null,
        content: [
          {
            type: "step",
            value: {
              number: 1,
              items: [
                { type: "text", value: "Cook " },
                { type: "ingredient", index: 0 },
                { type: "text", value: " for " },
                { type: "timer", index: 0 },
              ],
            },
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("tokenizeInstructionSdk", () => {
  it("tokenizes supported step items", () => {
    const result = tokenizeInstructionSdk(makeSdk());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.steps).toEqual([
        [
          { type: "text", value: "Cook " },
          {
            type: "ingredient",
            value: "red onion",
            canonicalName: "onion",
          },
          { type: "text", value: " for " },
          { type: "timer", value: "10 min" },
        ],
      ]);
    }
  });

  it("tokenizes cookware step items", () => {
    const sdk = makeSdk({
      sections: [
        {
          name: null,
          content: [
            {
              type: "step",
              value: {
                number: 1,
                items: [
                  { type: "text", value: "Preheat the " },
                  { type: "cookware", index: 0 },
                ],
              },
            },
          ],
        },
      ],
    });

    const result = tokenizeInstructionSdk(sdk);
    expect(result).toEqual({
      ok: true,
      steps: [
        [
          { type: "text", value: "Preheat the " },
          { type: "cookware", value: "oven" },
        ],
      ],
    });
  });

  it("fails for malformed indexes so caller can fallback", () => {
    const sdk = makeSdk({
      sections: [
        {
          name: null,
          content: [
            {
              type: "step",
              value: {
                number: 1,
                items: [{ type: "ingredient", index: 4 }],
              },
            },
          ],
        },
      ],
    });

    const result = tokenizeInstructionSdk(sdk);
    expect(result).toEqual({
      ok: false,
      reason: "Malformed ingredient item index: 4",
    });
  });

  it("fails for malformed cookware indexes so caller can fallback", () => {
    const sdk = makeSdk({
      sections: [
        {
          name: null,
          content: [
            {
              type: "step",
              value: {
                number: 1,
                items: [{ type: "cookware", index: 4 }],
              },
            },
          ],
        },
      ],
    });

    const result = tokenizeInstructionSdk(sdk);
    expect(result).toEqual({
      ok: false,
      reason: "Malformed cookware item index: 4",
    });
  });
});
