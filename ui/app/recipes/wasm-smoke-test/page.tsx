"use client";

import type { Ingredient, Step, Timer } from "@cooklang/cooklang";
import { useState } from "react";

const SAMPLE_RECIPE = `>> servings: 2
Simple Pasta

Boil @pasta{200%g} in salted water for ~{8%minutes}.
Drain and toss with @olive oil{2%tbsp}, @garlic{2%cloves}, and @parmesan{30%g}.`;

export default function RecipeWasmSmokeTestPage() {
  const [cooklangText, setCooklangText] = useState(SAMPLE_RECIPE);
  const [result, setResult] = useState<{
    sections: number;
    ingredientCount: number;
    timerCount: number;
    ingredients: string[];
    timers: string[];
    steps: string[];
  } | null>(null);
  const [error, setError] = useState<string>("");
  const [isParsing, setIsParsing] = useState(false);

  function stepToText(
    step: Step,
    ingredients: Ingredient[],
    timers: Timer[],
  ): string {
    return step.items
      .map((item) => {
        switch (item.type) {
          case "text":
            return item.value;
          case "ingredient":
            return ingredients[item.index]?.name ?? "(unknown ingredient)";
          case "timer": {
            const timer = timers[item.index];
            if (!timer) return "(unknown timer)";
            const timerLabel =
              typeof timer.name === "string" && timer.name.trim().length > 0
                ? timer.name
                : "timer";
            return `[${timerLabel}]`;
          }
          default:
            return "";
        }
      })
      .join("")
      .trim();
  }

  async function handleParseInBrowser() {
    setIsParsing(true);
    setError("");
    setResult(null);

    try {
      // Dynamic import ensures we exercise browser-side WASM loading.
      const { Parser, getQuantityUnit, getQuantityValue } = await import(
        "@cooklang/cooklang"
      );
      const parser = new Parser();
      const parsed = parser.parse(cooklangText);
      const ingredients = parsed.recipe.ingredients.map((ingredient, index) => {
        const qty = getQuantityValue(ingredient.quantity);
        const unit = getQuantityUnit(ingredient.quantity);
        const quantity =
          qty !== null ? `${qty}${unit ? ` ${unit}` : ""}` : "no quantity";
        return `${index + 1}. ${ingredient.name} (${quantity})`;
      });
      const timers = parsed.recipe.timers.map((timer, index) => {
        const qty = getQuantityValue(timer.quantity);
        const unit = getQuantityUnit(timer.quantity);
        const timerLabel =
          typeof timer.name === "string" && timer.name.trim().length > 0
            ? timer.name
            : "timer";
        const quantity =
          qty !== null ? `${qty}${unit ? ` ${unit}` : ""}` : "no quantity";
        return `${index + 1}. ${timerLabel} (${quantity})`;
      });
      const steps = parsed.recipe.sections.flatMap((section) =>
        section.content
          .filter((content) => content.type !== "text")
          .map((content) =>
            stepToText(
              content.value,
              parsed.recipe.ingredients,
              parsed.recipe.timers,
            ),
          )
          .filter((text) => text.length > 0),
      );

      setResult({
        sections: parsed.recipe.sections.length,
        ingredientCount: parsed.recipe.ingredients.length,
        timerCount: parsed.recipe.timers.length,
        ingredients,
        timers,
        steps,
      });
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : String(caughtError);
      setError(message);
    } finally {
      setIsParsing(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <h1 className="text-3xl font-bold">Cooklang WASM browser smoke test</h1>
      <p className="text-muted-foreground">
        This page parses Cooklang directly in the browser using the WASM parser.
      </p>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Cooklang input</span>
        <textarea
          className="min-h-56 rounded border border-border bg-background p-3 font-mono text-sm"
          onChange={(event) => setCooklangText(event.target.value)}
          value={cooklangText}
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
          disabled={isParsing}
          onClick={handleParseInBrowser}
          type="button"
        >
          {isParsing ? "Parsing…" : "Parse in browser"}
        </button>
      </div>

      {error ? (
        <pre className="overflow-auto rounded border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </pre>
      ) : null}

      {result ? (
        <section className="grid gap-4 rounded border border-border bg-muted/50 p-4">
          <h2 className="text-lg font-semibold">Parsed output</h2>
          <pre className="overflow-auto rounded border border-border bg-muted p-3 text-sm">
            {JSON.stringify(
              {
                sections: result.sections,
                ingredientCount: result.ingredientCount,
                timerCount: result.timerCount,
              },
              null,
              2,
            )}
          </pre>

          <div>
            <h3 className="mb-1 font-medium">Ingredients</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {result.ingredients.map((ingredient) => (
                <li key={ingredient}>{ingredient}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-1 font-medium">Timers</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {result.timers.length > 0 ? (
                result.timers.map((timer) => <li key={timer}>{timer}</li>)
              ) : (
                <li>No timers parsed.</li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="mb-1 font-medium">Step preview</h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {result.steps.length > 0 ? (
                result.steps.map((step, index) => (
                  <li key={`${index + 1}-${step}`}>{step}</li>
                ))
              ) : (
                <li>No steps parsed.</li>
              )}
            </ol>
          </div>
        </section>
      ) : null}
    </main>
  );
}
