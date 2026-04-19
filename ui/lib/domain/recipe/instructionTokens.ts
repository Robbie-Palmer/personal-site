import type { RecipeInstructionSdk } from "@/lib/domain/recipe/recipe";

export type InstructionDisplayToken =
  | {
      type: "text";
      value: string;
    }
  | {
      type: "ingredient";
      value: string;
      canonicalName: string;
      amount: number | null;
      unit: string | null;
    }
  | {
      type: "cookware";
      value: string;
    }
  | {
      type: "inlineQuantity";
      value: string;
    }
  | {
      type: "timer";
      value: string;
      durationSeconds: number | null;
    };

export type InstructionTokenizationResult =
  | { ok: true; steps: InstructionDisplayToken[][] }
  | { ok: false; reason: string };

function fromIndex(values: string[], index: number): string | null {
  const value = values[index];
  return typeof value === "string" ? value : null;
}

export function tokenizeInstructionSdk(
  instructionSdk: RecipeInstructionSdk,
): InstructionTokenizationResult {
  const steps: InstructionDisplayToken[][] = [];

  for (const section of instructionSdk.sections) {
    for (const content of section.content) {
      if (content.type === "text") {
        continue;
      }

      if (content.type !== "step") {
        return {
          ok: false,
          reason: `Unknown section content type: ${String((content as { type?: unknown }).type)}`,
        };
      }

      const tokens: InstructionDisplayToken[] = [];

      for (const item of content.value.items) {
        if (item.type === "text") {
          tokens.push({ type: "text", value: item.value });
          continue;
        }

        if (item.type === "ingredient") {
          const canonicalName = fromIndex(
            instructionSdk.ingredientNames,
            item.index,
          );
          const displayValue = fromIndex(
            instructionSdk.ingredientDisplayValues,
            item.index,
          );
          const amount = instructionSdk.ingredientAmounts[item.index] ?? null;
          const unit = instructionSdk.ingredientUnits[item.index] ?? null;
          if (canonicalName === null) {
            return {
              ok: false,
              reason: `Malformed ingredient item index: ${item.index}`,
            };
          }
          if (displayValue === null) {
            return {
              ok: false,
              reason: `Malformed ingredient display item index: ${item.index}`,
            };
          }
          tokens.push({
            type: "ingredient",
            value: displayValue,
            canonicalName,
            amount,
            unit,
          });
          continue;
        }

        if (item.type === "cookware") {
          const cookware = fromIndex(
            instructionSdk.cookwareDisplayValues,
            item.index,
          );
          if (cookware === null) {
            return {
              ok: false,
              reason: `Malformed cookware item index: ${item.index}`,
            };
          }
          tokens.push({ type: "cookware", value: cookware });
          continue;
        }

        if (item.type === "inlineQuantity") {
          const inlineQuantity = fromIndex(
            instructionSdk.inlineQuantityDisplayValues,
            item.index,
          );
          if (inlineQuantity === null) {
            return {
              ok: false,
              reason: `Malformed inline quantity item index: ${item.index}`,
            };
          }
          tokens.push({ type: "inlineQuantity", value: inlineQuantity });
          continue;
        }

        if (item.type === "timer") {
          const timer = fromIndex(
            instructionSdk.timerDisplayValues,
            item.index,
          );
          if (timer === null) {
            return {
              ok: false,
              reason: `Malformed timer item index: ${item.index}`,
            };
          }
          const durationSeconds =
            instructionSdk.timerDurationSeconds[item.index] ?? null;
          tokens.push({ type: "timer", value: timer, durationSeconds });
          continue;
        }

        return {
          ok: false,
          reason: `Unknown step item type: ${String((item as { type?: unknown }).type)}`,
        };
      }

      // Trim leading/trailing whitespace from boundary text tokens
      // to match the canonical stepToText output
      let first = tokens[0];
      while (first?.type === "text" && first.value.trimStart() === "") {
        tokens.shift();
        first = tokens[0];
      }
      if (first?.type === "text") {
        tokens[0] = { type: "text", value: first.value.trimStart() };
      }
      let last = tokens[tokens.length - 1];
      while (last?.type === "text" && last.value.trimEnd() === "") {
        tokens.pop();
        last = tokens[tokens.length - 1];
      }
      if (last?.type === "text") {
        tokens[tokens.length - 1] = {
          type: "text",
          value: last.value.trimEnd(),
        };
      }

      if (tokens.length === 0) {
        continue;
      }

      steps.push(tokens);
    }
  }

  if (steps.length === 0) {
    return {
      ok: false,
      reason: "No instruction steps produced from SDK sections",
    };
  }

  return { ok: true, steps };
}
