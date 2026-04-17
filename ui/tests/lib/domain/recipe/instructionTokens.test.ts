import { describe, expect, it } from "vitest";
import { tokenizeInstructionSdk } from "@/lib/domain/recipe/instructionTokens";
import type { RecipeInstructionSdk } from "@/lib/domain/recipe/recipe";

function makeSdk(
  overrides: Partial<RecipeInstructionSdk> = {},
): RecipeInstructionSdk {
  return {
    ingredientNames: ["onion"],
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
          { type: "text", value: "onion" },
          { type: "text", value: " for " },
          { type: "text", value: "10 min" },
        ],
      ]);
    }
  });

  it("fails for unknown item types so caller can fallback", () => {
    const sdk = makeSdk({
      sections: [
        {
          name: null,
          content: [
            {
              type: "step",
              value: {
                number: 1,
                items: [{ type: "cookware", index: 0 }],
              },
            },
          ],
        },
      ],
    });

    const result = tokenizeInstructionSdk(sdk);
    expect(result).toEqual({
      ok: false,
      reason: "Unknown step item type: cookware",
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
});
