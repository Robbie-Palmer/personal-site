"use client";

import { useState } from "react";

const SAMPLE_RECIPE = `>> servings: 2
Simple Pasta

Boil @pasta{200%g} in salted water for ~{8%minutes}.
Drain and toss with @olive oil{2%tbsp}, @garlic{2%cloves}, and @parmesan{30%g}.`;

export default function RecipeWasmSmokeTestPage() {
  const [cooklangText, setCooklangText] = useState(SAMPLE_RECIPE);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isParsing, setIsParsing] = useState(false);

  async function handleParseInBrowser() {
    setIsParsing(true);
    setError("");
    setResult("");

    try {
      // Dynamic import ensures we exercise browser-side WASM loading.
      const { Parser } = await import("@cooklang/cooklang");
      const parser = new Parser();
      const parsed = parser.parse(cooklangText);
      setResult(
        JSON.stringify(
          {
            sections: parsed.recipe.sections.length,
            ingredientCount: parsed.recipe.ingredients.length,
            timerCount: parsed.recipe.timers.length,
          },
          null,
          2,
        ),
      );
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
        <pre className="overflow-auto rounded border border-border bg-muted p-4 text-sm">
          {result}
        </pre>
      ) : null}
    </main>
  );
}
