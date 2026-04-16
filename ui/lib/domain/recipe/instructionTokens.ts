import type { RecipeInstructionSdk } from "@/lib/domain/recipe/recipe";

export type InstructionDisplayToken = {
  type: "text";
  value: string;
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
          const ingredient = fromIndex(
            instructionSdk.ingredientNames,
            item.index,
          );
          if (!ingredient) {
            return {
              ok: false,
              reason: `Malformed ingredient item index: ${item.index}`,
            };
          }
          tokens.push({ type: "text", value: ingredient });
          continue;
        }

        if (item.type === "timer") {
          const timer = fromIndex(
            instructionSdk.timerDisplayValues,
            item.index,
          );
          if (!timer) {
            return {
              ok: false,
              reason: `Malformed timer item index: ${item.index}`,
            };
          }
          tokens.push({ type: "text", value: timer });
          continue;
        }

        return {
          ok: false,
          reason: `Unknown step item type: ${String((item as { type?: unknown }).type)}`,
        };
      }

      const rendered = tokens
        .map((token) => token.value)
        .join("")
        .trim();
      if (rendered.length === 0) {
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
