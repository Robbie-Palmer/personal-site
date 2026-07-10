"use client";

import {
  Check,
  Leaf,
  LoaderCircle,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type DietProfile,
  type DietRecipeMatchMode,
  emptyDietProfile,
  getDietProfile,
  saveDietProfile,
} from "@/lib/api/diet";
import { cn } from "@/lib/generic/styles";
import { PanelHead } from "./panel-head";

type SaveState = "idle" | "saving" | "saved" | "error";

type DietPreset = {
  key: string;
  label: string;
  sub: string;
  excludedGroupKeys: string[];
  excludedIngredientSlugs?: string[];
};

type DietGroup = {
  key: string;
  label: string;
  sub: string;
};

const DIET_PRESETS: DietPreset[] = [
  {
    key: "vegetarian",
    label: "Vegetarian",
    sub: "no meat or fish",
    excludedGroupKeys: ["meat", "poultry", "fish", "shellfish"],
  },
  {
    key: "vegan",
    label: "Vegan",
    sub: "no animal products",
    excludedGroupKeys: ["meat", "poultry", "fish", "shellfish", "dairy", "egg"],
    excludedIngredientSlugs: ["honey"],
  },
  {
    key: "pescatarian",
    label: "Pescatarian",
    sub: "no meat, fish ok",
    excludedGroupKeys: ["meat", "poultry"],
  },
  {
    key: "dairy-free",
    label: "Dairy-free",
    sub: "no milk or cheese",
    excludedGroupKeys: ["dairy"],
  },
  {
    key: "gluten-free",
    label: "Gluten-free",
    sub: "no wheat or gluten",
    excludedGroupKeys: ["gluten"],
  },
  {
    key: "low-fodmap",
    label: "Low-FODMAP review",
    sub: "flag common triggers",
    excludedGroupKeys: ["onion", "garlic", "wheat", "legumes"],
  },
];

const EXCLUSION_GROUPS: DietGroup[] = [
  { key: "meat", label: "Meat", sub: "beef, pork, lamb" },
  { key: "poultry", label: "Poultry", sub: "chicken, turkey" },
  { key: "fish", label: "Fish", sub: "salmon, tuna" },
  { key: "shellfish", label: "Shellfish", sub: "prawns, mussels" },
  { key: "dairy", label: "Dairy", sub: "milk, cheese" },
  { key: "egg", label: "Egg", sub: "egg and egg yolk" },
  { key: "gluten", label: "Gluten", sub: "wheat, barley, rye" },
  { key: "nuts", label: "Tree nuts", sub: "almond, cashew" },
  { key: "peanut", label: "Peanut", sub: "peanut products" },
  { key: "soy", label: "Soy", sub: "soy sauce, tofu" },
  { key: "onion", label: "Onion", sub: "onions, shallots" },
  { key: "garlic", label: "Garlic", sub: "garlic, granules" },
  { key: "chilli", label: "Chilli", sub: "fresh or dried" },
  { key: "alcohol", label: "Alcohol", sub: "wine, beer, spirits" },
];

const presetByKey = new Map(DIET_PRESETS.map((preset) => [preset.key, preset]));

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function labelFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function serialize(profile: DietProfile): string {
  return JSON.stringify(profile);
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}

function summarise(profile: DietProfile) {
  const presetLabels = profile.presetDietKeys
    .map((key) => presetByKey.get(key)?.label ?? labelFromSlug(key))
    .slice(0, 2);
  const extraCount =
    profile.excludedIngredientSlugs.length + profile.excludedGroupKeys.length;
  const parts = [...presetLabels];
  if (extraCount > 0) parts.push(`${extraCount} custom`);
  return parts.length > 0 ? parts.join(" / ") : "No diet filters set";
}

function effectiveExclusions(profile: DietProfile) {
  const presetGroups = profile.presetDietKeys.flatMap(
    (key) => presetByKey.get(key)?.excludedGroupKeys ?? [],
  );
  const presetIngredients = profile.presetDietKeys.flatMap(
    (key) => presetByKey.get(key)?.excludedIngredientSlugs ?? [],
  );

  return {
    groups: unique([...presetGroups, ...profile.excludedGroupKeys]),
    ingredients: unique([
      ...presetIngredients,
      ...profile.excludedIngredientSlugs,
    ]),
  };
}

function Status({ state, error }: { state: SaveState; error: string | null }) {
  if (state === "saving") {
    return (
      <>
        <LoaderCircle className="size-3.5 animate-spin text-[var(--ink-3)]" />
        <span className="rt-mono text-[var(--ink-3)]">saving...</span>
      </>
    );
  }
  if (state === "saved") {
    return (
      <>
        <Check className="size-3.5 text-[var(--sage)]" />
        <span className="rt-mono text-[var(--sage)]">saved</span>
      </>
    );
  }
  if (state === "error") {
    return (
      <>
        <TriangleAlert className="size-3.5 text-[var(--destructive)]" />
        <span role="alert" className="rt-mono text-[var(--destructive)]">
          {error}
        </span>
      </>
    );
  }
  return (
    <>
      <span className="size-2 rounded-full bg-[var(--sage)]" />
      <span className="rt-mono text-[var(--sage)]">ready to save</span>
    </>
  );
}

export function DietPanel() {
  const [profile, setProfile] = useState<DietProfile>(emptyDietProfile);
  const [savedProfile, setSavedProfile] =
    useState<DietProfile>(emptyDietProfile);
  const [ingredientInput, setIngredientInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const next = await getDietProfile(controller.signal);
        setProfile(next);
        setSavedProfile(next);
        setSaveState("idle");
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setSaveState("error");
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Couldn't load your diet profile.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  const dirty = serialize(profile) !== serialize(savedProfile);
  const exclusions = useMemo(() => effectiveExclusions(profile), [profile]);

  function updateProfile(next: DietProfile) {
    setProfile(next);
    setSaveState("idle");
    setError(null);
  }

  function togglePreset(key: string) {
    updateProfile({
      ...profile,
      presetDietKeys: toggleValue(profile.presetDietKeys, key),
    });
  }

  function toggleGroup(key: string) {
    updateProfile({
      ...profile,
      excludedGroupKeys: toggleValue(profile.excludedGroupKeys, key),
    });
  }

  function setMode(recipeMatchMode: DietRecipeMatchMode) {
    updateProfile({ ...profile, recipeMatchMode });
  }

  function addIngredient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slug = slugify(ingredientInput);
    if (!slug) return;
    updateProfile({
      ...profile,
      excludedIngredientSlugs: unique([
        ...profile.excludedIngredientSlugs,
        slug,
      ]),
    });
    setIngredientInput("");
  }

  function removeIngredient(slug: string) {
    updateProfile({
      ...profile,
      excludedIngredientSlugs: profile.excludedIngredientSlugs.filter(
        (ingredient) => ingredient !== slug,
      ),
    });
  }

  async function save() {
    setSaveState("saving");
    setError(null);
    try {
      const saved = await saveDietProfile(profile);
      setProfile(saved);
      setSavedProfile(saved);
      setSaveState("saved");
    } catch (saveError) {
      setSaveState("error");
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Couldn't save your diet profile.",
      );
    }
  }

  return (
    <div>
      <PanelHead
        kicker="YOUR DIET"
        title="Set once, filters everywhere."
        sub="Choose dietary presets, then add the specific ingredient groups or ingredients you want recipes to account for."
      />

      <div className="mb-5 flex items-center gap-3 rounded-lg border border-[var(--butter)] bg-[var(--butter-soft)] px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--sage)] text-white">
          <Leaf className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="rt-body font-semibold text-[var(--ink)]">
            {summarise(profile)}
          </p>
          <p className="rt-mono mt-0.5 text-[var(--ink-3)]">
            {exclusions.groups.length + exclusions.ingredients.length} effective
            exclusions
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-[var(--ink-3)]">
          <LoaderCircle className="size-4 animate-spin" />
          <span className="rt-mono">loading diet profile...</span>
        </div>
      ) : (
        <>
          <section className="mb-7">
            <p className="rt-mono mb-3 text-[var(--terracotta)]">
              DIETARY CHOICES
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {DIET_PRESETS.map((preset) => {
                const active = profile.presetDietKeys.includes(preset.key);
                return (
                  <button
                    key={preset.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => togglePreset(preset.key)}
                    className={cn(
                      "flex min-h-20 items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                      active
                        ? "border-[var(--terracotta)] bg-[var(--butter-soft)]"
                        : "border-[var(--line)] bg-[var(--card)] hover:border-[var(--line-strong)]",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                        active
                          ? "border-[var(--terracotta)] bg-[var(--terracotta)] text-white"
                          : "border-[var(--line-strong)] bg-[var(--paper)] text-transparent",
                      )}
                    >
                      <Check className="size-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="rt-body block font-semibold text-[var(--ink)]">
                        {preset.label}
                      </span>
                      <span className="rt-mono mt-1 block text-[var(--ink-4)]">
                        {preset.sub}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mb-7">
            <p className="rt-mono mb-3 text-[var(--terracotta)]">
              GROUPS TO EXCLUDE OR WARN ON
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {EXCLUSION_GROUPS.map((group) => {
                const active = profile.excludedGroupKeys.includes(group.key);
                const coveredByPreset = profile.presetDietKeys.some((key) =>
                  presetByKey.get(key)?.excludedGroupKeys.includes(group.key),
                );
                return (
                  <button
                    key={group.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleGroup(group.key)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors",
                      active
                        ? "border-[var(--terracotta)] bg-[var(--butter-soft)]"
                        : "border-[var(--line)] bg-[var(--card)] hover:border-[var(--line-strong)]",
                    )}
                  >
                    <span className="rt-body block text-[0.95rem] font-semibold text-[var(--ink)]">
                      {group.label}
                    </span>
                    <span className="rt-mono mt-0.5 block text-[var(--ink-4)]">
                      {coveredByPreset
                        ? "already covered by preset"
                        : group.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mb-7">
            <p className="rt-mono mb-3 text-[var(--terracotta)]">
              SPECIFIC INGREDIENTS
            </p>
            <form onSubmit={addIngredient} className="flex max-w-lg gap-2">
              <Input
                value={ingredientInput}
                onChange={(event) => setIngredientInput(event.target.value)}
                placeholder="egg, coriander, chilli oil..."
                aria-label="Ingredient to exclude"
                className="bg-[var(--card)]"
              />
              <Button type="submit" variant="outline" className="shrink-0">
                <Plus className="size-4" />
                Add
              </Button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.excludedIngredientSlugs.length > 0 ? (
                profile.excludedIngredientSlugs.map((slug) => (
                  <span
                    key={slug}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--terracotta)] bg-[var(--butter-soft)] px-3 py-1 text-[0.85rem] text-[var(--ink)]"
                  >
                    {labelFromSlug(slug)}
                    <button
                      type="button"
                      onClick={() => removeIngredient(slug)}
                      aria-label={`Remove ${labelFromSlug(slug)}`}
                      className="rounded-full text-[var(--terracotta-deep)] hover:bg-[var(--paper-warm)]"
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))
              ) : (
                <p className="rt-mono text-[var(--ink-4)]">
                  No ingredient-level exclusions yet.
                </p>
              )}
            </div>
          </section>

          <section className="mb-7">
            <p className="rt-mono mb-3 text-[var(--terracotta)]">
              WHEN A RECIPE BREAKS YOUR DIET
            </p>
            <div className="inline-flex rounded-full border border-[var(--line)] bg-[var(--paper-warm)] p-1">
              {(
                [
                  ["hide", "Hide it"],
                  ["warn", "Show warning"],
                ] as const
              ).map(([value, label]) => {
                const active = profile.recipeMatchMode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={cn(
                      "rt-body rounded-full px-4 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-[var(--ink)] font-semibold text-[var(--paper)]"
                        : "text-[var(--ink-2)] hover:bg-[var(--card)]",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-5 sm:flex-row sm:items-center">
            <Button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || saveState === "saving"}
              className="bg-[var(--terracotta)] text-white hover:bg-[var(--terracotta-deep)]"
            >
              {saveState === "saving" ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Save diet profile
            </Button>
            <div className="flex items-center gap-2" aria-live="polite">
              <Status
                state={dirty && saveState === "saved" ? "idle" : saveState}
                error={error}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
