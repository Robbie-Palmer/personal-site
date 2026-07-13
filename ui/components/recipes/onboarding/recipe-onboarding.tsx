"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChefHat,
  Loader2,
  PenLine,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthButton } from "@/components/recipes/auth-button";
import { RecipeThumb, recipeMetaLabel } from "@/components/recipes/recipe-card";
import { Button } from "@/components/ui/button";
import {
  type DietOptions,
  type DietPresetOption,
  type DietProfile,
  emptyDietOptions,
  emptyDietProfile,
  getDietOptions,
  getDietProfile,
  saveDietProfile,
} from "@/lib/api/diet";
import {
  getRecipeBoxProfile,
  saveRecipeBoxProfile,
} from "@/lib/api/recipe-box";
import type { RecipeCardView } from "@/lib/api/recipes";
import { authClient } from "@/lib/auth-client";
import { buildEffectiveDiet, matchRecipeToDiet } from "@/lib/domain/diet";
import {
  type SavedRecipeApiRecord,
  savedRecipeCard,
} from "@/lib/domain/recipe/recipeDraft";
import { cn } from "@/lib/generic/styles";

const STEPS = ["sign up", "your diet", "fill your box", "ready"];

function StepRail({ step }: Readonly<{ step: number }>) {
  return (
    <ol aria-label="Onboarding progress" className="flex items-center gap-2">
      {STEPS.map((label, index) => (
        <li key={label} className="flex items-center gap-2">
          {index > 0 && (
            <span
              aria-hidden="true"
              className={cn(
                "hidden h-px w-5 sm:block",
                index <= step ? "bg-[var(--ink)]" : "bg-[var(--line-strong)]",
              )}
            />
          )}
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                "rt-mono flex size-6 items-center justify-center rounded-full border text-[0.65rem]",
                index < step &&
                  "border-[var(--ink)] bg-[var(--ink)] text-[var(--butter)]",
                index === step && "border-[var(--ink)] bg-[var(--butter)]",
                index > step &&
                  "border-[var(--line-strong)] text-[var(--ink-3)]",
              )}
            >
              {index < step ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span
              className={cn(
                "rt-body hidden text-sm md:inline",
                index === step
                  ? "font-bold text-[var(--ink)]"
                  : "text-[var(--ink-3)]",
              )}
            >
              {label}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Intro() {
  return (
    <div className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center py-12 text-center">
      <ChefHat className="size-12 text-[var(--terracotta)]" />
      <p className="rt-mono mt-5 text-[var(--terracotta)]">
        Welcome — let&apos;s set up your box
      </p>
      <h1 className="rt-display mt-3 text-5xl leading-[0.95] sm:text-7xl">
        A few minutes to a box that{" "}
        <span className="text-[var(--terracotta)]">feels yours.</span>
      </h1>
      <p className="rt-body mt-5 max-w-lg text-lg text-[var(--ink-2)]">
        Create a free account, set your diet, then choose a few recipes or write
        one of your own with Cooklang.
      </p>
      <div className="mt-7">
        <AuthButton intent="signup" />
      </div>
      <p className="rt-mono mt-4 text-[var(--ink-4)]">
        Google or GitHub · your recipes stay yours
      </p>
    </div>
  );
}

async function fetchAuthoredRecipes(signal: AbortSignal) {
  const response = await fetch("/api/recipes", { signal });
  if (!response.ok) {
    throw new Error("Your authored recipes could not be loaded.");
  }
  return (await response.json()) as SavedRecipeApiRecord[];
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}

function DietPresetTile({
  active,
  onToggle,
  preset,
}: Readonly<{
  active: boolean;
  onToggle: (key: string) => void;
  preset: DietPresetOption;
}>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onToggle(preset.key)}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
        active
          ? "border-[var(--terracotta)] bg-[var(--butter-soft)]"
          : "border-[var(--line-strong)] bg-[var(--card)] hover:border-[var(--terracotta)]",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
          active
            ? "border-[var(--terracotta)] bg-[var(--terracotta)] text-white"
            : "border-[var(--line-strong)]",
        )}
      >
        <Check className="size-3.5" />
      </span>
      <span>
        <span className="rt-body block font-bold">{preset.label}</span>
        <span className="rt-mono mt-1 block text-[var(--ink-3)]">
          {preset.sub}
        </span>
      </span>
    </button>
  );
}

function StarterRecipeTile({
  onToggle,
  recipe,
  selected,
}: Readonly<{
  onToggle: (slug: string) => void;
  recipe: RecipeCardView;
  selected: boolean;
}>) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onToggle(recipe.slug)}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
        selected
          ? "border-[var(--terracotta)] bg-[var(--butter-soft)] ring-1 ring-[var(--terracotta)]"
          : "border-[var(--line-strong)] bg-[var(--card)] hover:-translate-y-0.5 hover:shadow-[var(--paper-shadow)]",
      )}
    >
      <RecipeThumb recipe={recipe} size={54} />
      <span className="min-w-0 flex-1">
        <span className="rt-display block text-xl leading-none">
          {recipe.title}
        </span>
        <span className="rt-mono mt-1 block truncate text-[var(--ink-3)]">
          {recipeMetaLabel(recipe)}
        </span>
      </span>
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full border",
          selected
            ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--butter)]"
            : "border-[var(--line-strong)]",
        )}
      >
        {selected ? <Check className="size-4" /> : "+"}
      </span>
    </button>
  );
}

export function RecipeOnboarding({
  recipes,
}: Readonly<{ recipes: RecipeCardView[] }>) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [step, setStep] = useState(0);
  const [diet, setDiet] = useState<DietProfile>(emptyDietProfile);
  const [dietOptions, setDietOptions] = useState<DietOptions>(emptyDietOptions);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [authoredRecipes, setAuthoredRecipes] = useState<
    SavedRecipeApiRecord[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionPending || !session) return;
    const requestedBoxStep =
      new URLSearchParams(window.location.search).get("step") === "box";
    setStep(requestedBoxStep ? 2 : 1);
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void Promise.all([
      getDietProfile(controller.signal),
      getDietOptions(controller.signal),
      getRecipeBoxProfile(controller.signal),
      fetchAuthoredRecipes(controller.signal),
    ])
      .then(([profile, options, box, saved]) => {
        setDiet(profile);
        setDietOptions(options);
        setSelectedSlugs(box.staticRecipeSlugs);
        setAuthoredRecipes(saved.filter((record) => savedRecipeCard(record)));
      })
      .catch((error_: unknown) => {
        if (!(error_ instanceof DOMException && error_.name === "AbortError")) {
          setError(
            error_ instanceof Error
              ? error_.message
              : "Setup could not be loaded.",
          );
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [session, sessionPending]);

  const effectiveDiet = useMemo(
    () => buildEffectiveDiet(diet, dietOptions),
    [diet, dietOptions],
  );
  const compatibleRecipes = useMemo(() => {
    const matching = recipes.filter(
      (recipe) =>
        matchRecipeToDiet(
          {
            ingredients: recipe.ingredientSlugs.map((slug, index) => ({
              slug,
              name: recipe.ingredientNames[index],
            })),
          },
          effectiveDiet,
        ).matches,
    );
    return (matching.length >= 6 ? matching : recipes).slice(0, 12);
  }, [effectiveDiet, recipes]);
  const selectedSet = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);
  const boxCount = selectedSlugs.length + authoredRecipes.length;

  function toggleDietPreset(key: string) {
    setDiet((current) => ({
      ...current,
      presetDietKeys: toggleValue(current.presetDietKeys, key),
    }));
  }

  function toggleSelectedRecipe(slug: string) {
    setSelectedSlugs((current) => toggleValue(current, slug));
  }

  async function continueFromDiet() {
    setSaving(true);
    setError(null);
    try {
      setDiet(await saveDietProfile(diet));
      setStep(2);
    } catch (error_) {
      setError(
        error_ instanceof Error
          ? error_.message
          : "Your diet could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function finishBox() {
    setSaving(true);
    setError(null);
    try {
      await saveRecipeBoxProfile(selectedSlugs);
      setStep(3);
    } catch (error_) {
      setError(
        error_ instanceof Error
          ? error_.message
          : "Your recipe box could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (sessionPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-10rem)] max-w-6xl flex-col px-4 py-5 md:py-8">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
        <Link href="/recipes" className="rt-display text-2xl">
          Your recipe box
        </Link>
        <StepRail step={step} />
      </div>

      {!session && <Intro />}

      {session && loading && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="animate-spin text-[var(--terracotta)]" />
        </div>
      )}

      {session && !loading && step === 1 && (
        <section className="flex-1 py-8">
          <p className="rt-mono text-[var(--terracotta)]">
            Step 2 · filters every recipe list
          </p>
          <h1 className="rt-display mt-2 text-5xl sm:text-6xl">
            Anything you don&apos;t eat?
          </h1>
          <p className="rt-body mt-3 max-w-2xl text-[var(--ink-2)]">
            Choose any presets that fit. You can fine-tune ingredients and
            change how matches are shown later in settings.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dietOptions.presets.map((preset) => (
              <DietPresetTile
                key={preset.key}
                preset={preset}
                active={diet.presetDietKeys.includes(preset.key)}
                onToggle={toggleDietPreset}
              />
            ))}
          </div>
          {dietOptions.presets.length === 0 && (
            <p className="rt-body mt-7 rounded-xl border border-dashed p-4 text-[var(--ink-3)]">
              No diet presets are available yet. You can continue and configure
              exclusions later.
            </p>
          )}
        </section>
      )}

      {session && !loading && step === 2 && (
        <section className="flex-1 py-8">
          <p className="rt-mono text-[var(--terracotta)]">
            Step 3 · make it yours
          </p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="rt-display mt-2 text-5xl sm:text-6xl">
                Put a few recipes in.
              </h1>
              <p className="rt-body mt-3 text-[var(--ink-2)]">
                Pick from the current collection, or author your own recipe as
                Cooklang text.
              </p>
            </div>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/recipes/add?returnTo=%2Frecipes%2Fonboarding%3Fstep%3Dbox">
                <PenLine /> Write your own
              </Link>
            </Button>
          </div>
          {authoredRecipes.length > 0 && (
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-[var(--sage)]/50 bg-[var(--sage)]/10 px-4 py-3">
              <PenLine className="size-5 text-[var(--sage)]" />
              <p className="rt-body">
                <b>
                  {authoredRecipes.length} authored{" "}
                  {authoredRecipes.length === 1 ? "recipe" : "recipes"}
                </b>{" "}
                already in your box.
              </p>
            </div>
          )}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {compatibleRecipes.map((recipe) => (
              <StarterRecipeTile
                key={recipe.slug}
                recipe={recipe}
                selected={selectedSet.has(recipe.slug)}
                onToggle={toggleSelectedRecipe}
              />
            ))}
          </div>
        </section>
      )}

      {session && !loading && step === 3 && (
        <section className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center py-12 text-center">
          <Sparkles className="size-12 text-[var(--terracotta)]" />
          <p className="rt-mono mt-5 text-[var(--terracotta)]">
            You&apos;re all set
          </p>
          <h1 className="rt-display mt-3 text-6xl leading-none">
            Your box has {boxCount} {boxCount === 1 ? "recipe" : "recipes"}.
          </h1>
          <p className="rt-body mt-4 text-lg text-[var(--ink-2)]">
            Your diet will filter the collection, and you can keep writing
            recipes in Cooklang whenever inspiration strikes.
          </p>
          <Button
            asChild
            className="mt-7 rounded-full bg-[var(--terracotta)] text-white hover:bg-[var(--terracotta-deep)]"
          >
            <Link href="/recipes">
              <BookOpen /> Open my recipe box <ArrowRight />
            </Link>
          </Button>
        </section>
      )}

      {session && !loading && step > 0 && step < 3 && (
        <footer className="sticky bottom-0 -mx-4 mt-auto flex flex-wrap items-center gap-3 border-t border-[var(--line)] bg-[var(--paper)]/95 px-4 py-4 backdrop-blur">
          <div className="rt-body mr-auto text-[var(--ink-3)]">
            {step === 1 ? (
              "You can skip this and set it later."
            ) : (
              <>
                <b className="text-[var(--ink)]">{boxCount}</b>{" "}
                {boxCount === 1 ? "recipe" : "recipes"} in your box
              </>
            )}
          </div>
          {step === 2 && (
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft /> Back
            </Button>
          )}
          {step === 1 && (
            <Button variant="outline" onClick={() => setStep(2)}>
              Skip
            </Button>
          )}
          {step === 1 ? (
            <Button onClick={continueFromDiet} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Continue{" "}
              <ArrowRight />
            </Button>
          ) : (
            <Button onClick={finishBox} disabled={saving || boxCount === 0}>
              {saving && <Loader2 className="animate-spin" />} Finish setup{" "}
              <ArrowRight />
            </Button>
          )}
        </footer>
      )}
      {error && (
        <p
          role="alert"
          className="rt-body mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
