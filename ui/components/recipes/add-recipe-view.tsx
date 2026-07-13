"use client";

import {
  AlertCircle,
  ArrowLeft,
  FileText,
  Loader2,
  Save,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { RecipeContent } from "@/components/recipes/recipe-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCooklangRecipe } from "@/hooks/use-cooklang-recipe";
import { authClient } from "@/lib/auth-client";
import {
  buildRecipeDraft,
  normalizeRecipeSource,
  serializeSavedRecipe,
} from "@/lib/domain/recipe/recipeDraft";
import { normalizeSlug } from "@/lib/generic/slugs";

const EXAMPLE_RECIPE = `Bring a large #pot{} of salted water to the boil. Add @dried pasta{200%g} and cook for ~{10%minutes}.

Meanwhile, warm @olive oil{2%tbsp} in a #frying pan{}. Add @garlic{2%cloves} and cook for ~{2%minutes}.

Stir in @chopped tomatoes{400%g} and simmer for ~{15%minutes}. Drain the pasta, toss it through the sauce, and serve.`;

function NumberField({
  label,
  value,
  onChange,
  min = 0,
}: Readonly<{
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
}>) {
  const id = useId();
  return (
    <label htmlFor={id} className="grid gap-1.5">
      <span className="rt-mono text-[var(--ink-3)]">{label}</span>
      <Input
        id={id}
        type="number"
        min={min}
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : undefined)
        }
        className="border-[var(--line-strong)] bg-[var(--card)]"
      />
    </label>
  );
}

export function AddRecipeView() {
  const titleId = useId();
  const descriptionId = useId();
  const cuisineId = useId();
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [servings, setServings] = useState<number | undefined>(2);
  const [prepTime, setPrepTime] = useState<number | undefined>();
  const [cookTime, setCookTime] = useState<number | undefined>();
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const cooklang = useMemo(() => normalizeRecipeSource(source), [source]);
  const parse = useCooklangRecipe(cooklang);

  const preview = useMemo(() => {
    if (!parse.recipe || !title.trim() || !description.trim() || !servings)
      return null;
    try {
      return buildRecipeDraft(
        parse.recipe,
        { title, description, cuisine, servings, prepTime, cookTime },
        source,
      );
    } catch {
      return null;
    }
  }, [
    parse.recipe,
    title,
    description,
    cuisine,
    servings,
    prepTime,
    cookTime,
    source,
  ]);

  async function saveRecipe() {
    if (!preview) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/recipes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: normalizeSlug(title),
          title: title.trim(),
          description: description.trim(),
          body: serializeSavedRecipe(source, preview),
          visibility: "private",
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          details?: Array<{ message?: string }>;
        } | null;
        const details = body?.details
          ?.map((detail) => detail.message)
          .filter((message): message is string => Boolean(message))
          .join(" ");
        throw new Error(
          details || body?.error || "The recipe could not be saved.",
        );
      }
      const saved = (await response.json()) as { slug: string };
      router.push(`/recipes/saved?slug=${encodeURIComponent(saved.slug)}`);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "The recipe could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (sessionPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <FileText className="mx-auto size-10 text-[var(--terracotta)]" />
        <h1 className="rt-display mt-4 text-5xl">Sign in to save a recipe</h1>
        <p className="rt-body mt-3 text-[var(--ink-2)]">
          Use the sign-in button above, then come back to add recipes to your
          private recipe box.
        </p>
        <Button asChild variant="outline" className="mt-6 rounded-full">
          <Link href="/recipes">
            <ArrowLeft /> Back to recipes
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-[1600px] px-4 py-6 md:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/recipes"
            className="rt-mono inline-flex items-center gap-1 text-[var(--ink-3)] hover:text-[var(--terracotta)]"
          >
            <ArrowLeft className="size-3.5" /> Recipe box
          </Link>
          <h1 className="rt-display mt-2 text-5xl sm:text-6xl">
            Add a <span className="text-[var(--terracotta)]">recipe</span>
          </h1>
          <p className="rt-body mt-2 text-[var(--ink-2)]">
            Write the recipe naturally, adding Cooklang syntax inline. The
            preview updates as you type.
          </p>
        </div>
        <Button
          onClick={saveRecipe}
          disabled={!preview || saving}
          className="rounded-full bg-[var(--ink)] px-5 text-[var(--paper)] hover:bg-[var(--terracotta-deep)]"
        >
          {saving ? <Loader2 className="animate-spin" /> : <Save />} Save recipe
        </Button>
      </div>

      {saveError && (
        <div
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="size-4" />
          {saveError}
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(380px,0.8fr)_minmax(540px,1.2fr)]">
        <section className="rounded-xl border-[1.25px] border-[var(--line-strong)] bg-[var(--card)] p-4 shadow-[var(--paper-shadow)] xl:sticky xl:top-24">
          <div className="grid gap-4">
            <label htmlFor={titleId} className="grid gap-1.5">
              <span className="rt-mono text-[var(--ink-3)]">Recipe name</span>
              <Input
                id={titleId}
                value={title}
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Weeknight tomato pasta"
                className="border-[var(--line-strong)] bg-[var(--paper)] text-lg"
              />
            </label>
            <label htmlFor={descriptionId} className="grid gap-1.5">
              <span className="rt-mono text-[var(--ink-3)]">
                Short description
              </span>
              <Input
                id={descriptionId}
                value={description}
                maxLength={500}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="A quick, cosy pasta for busy evenings"
                className="border-[var(--line-strong)] bg-[var(--paper)]"
              />
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
              <NumberField
                label="Servings"
                value={servings}
                min={1}
                onChange={setServings}
              />
              <NumberField
                label="Prep minutes"
                value={prepTime}
                onChange={setPrepTime}
              />
              <NumberField
                label="Cook minutes"
                value={cookTime}
                onChange={setCookTime}
              />
              <label htmlFor={cuisineId} className="grid gap-1.5">
                <span className="rt-mono text-[var(--ink-3)]">Cuisine</span>
                <Input
                  id={cuisineId}
                  value={cuisine}
                  onChange={(event) => setCuisine(event.target.value)}
                  placeholder="Italian"
                  className="border-[var(--line-strong)] bg-[var(--card)]"
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-dashed border-[var(--line-strong)] pt-3">
              <div>
                <p className="rt-mono text-[var(--ink-3)]">Recipe text</p>
                <p className="text-xs text-[var(--ink-3)]">
                  Use @ingredients, #cookware and ~timers directly in each step.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  setTitle("Weeknight tomato pasta");
                  setDescription("A quick, cosy pasta for busy evenings.");
                  setCuisine("Italian");
                  setPrepTime(5);
                  setCookTime(25);
                  setSource(EXAMPLE_RECIPE);
                }}
              >
                <Sparkles /> Try example
              </Button>
            </div>
            <textarea
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder={EXAMPLE_RECIPE}
              maxLength={10000}
              spellCheck
              className="rt-body min-h-[360px] w-full resize-y rounded-lg border border-[var(--line-strong)] bg-[var(--paper)] p-3 text-base leading-relaxed outline-none transition-shadow placeholder:text-[var(--ink-4)] focus:border-[var(--terracotta)] focus:ring-3 focus:ring-[var(--terracotta)]/15"
            />
          </div>
        </section>

        <section className="min-h-[600px] overflow-hidden rounded-xl border-[1.25px] border-[var(--line-strong)] bg-[var(--paper)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--paper-warm)] px-4 py-3">
            <p className="rt-mono text-[var(--ink-3)]">Live preview</p>
            {parse.loading && (
              <Loader2 className="size-4 animate-spin text-[var(--terracotta)]" />
            )}
          </div>
          {preview ? (
            <div className="px-4 py-6 md:px-8">
              <RecipeContent recipe={preview} />
            </div>
          ) : (
            <div className="flex min-h-[540px] flex-col items-center justify-center px-6 text-center">
              <FileText className="size-12 text-[var(--terracotta)]/50" />
              <h2 className="rt-display mt-4 text-4xl">
                Your recipe will appear here
              </h2>
              <p className="rt-body mt-2 max-w-md text-[var(--ink-3)]">
                Add a name and write your steps with inline Cooklang—or use the
                example to see ingredients and timers come alive.
              </p>
              {parse.error && (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  We couldn&apos;t read that recipe yet. Check the Cooklang
                  syntax and try again.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
