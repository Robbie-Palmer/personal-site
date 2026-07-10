"use client";

import {
  Check,
  Leaf,
  LoaderCircle,
  Plus,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type DietIngredientOption,
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

const INGREDIENT_RESULT_LIMIT = 8;
const presetByKey = new Map(DIET_PRESETS.map((preset) => [preset.key, preset]));

function labelFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function serialize(profile: DietProfile): string {
  return JSON.stringify({
    ...profile,
    presetDietKeys: [...profile.presetDietKeys].sort(),
    excludedIngredientSlugs: [...profile.excludedIngredientSlugs].sort(),
    excludedGroupKeys: [...profile.excludedGroupKeys].sort(),
  });
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}

function summarise(profile: DietProfile) {
  const presetLabels = profile.presetDietKeys.map(
    (key) => presetByKey.get(key)?.label ?? labelFromSlug(key),
  );
  const displayedPresets = presetLabels.slice(0, 2);
  const remainingPresetCount = presetLabels.length - displayedPresets.length;
  const customCount =
    profile.excludedIngredientSlugs.length + profile.excludedGroupKeys.length;
  const parts = [...displayedPresets];
  if (remainingPresetCount > 0) parts.push(`+${remainingPresetCount} more`);
  if (customCount > 0) parts.push(`${customCount} custom`);
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

function SectionLabel({ children }: Readonly<{ children: ReactNode }>) {
  return <p className="rt-mono mb-3 text-[var(--terracotta)]">{children}</p>;
}

function Status({
  state,
  error,
}: Readonly<{
  state: SaveState;
  error: string | null;
}>) {
  const content = {
    idle: {
      icon: <span className="size-2 rounded-full bg-[var(--sage)]" />,
      text: "ready to save",
      className: "text-[var(--sage)]",
    },
    saving: {
      icon: (
        <LoaderCircle className="size-3.5 animate-spin text-[var(--ink-3)]" />
      ),
      text: "saving...",
      className: "text-[var(--ink-3)]",
    },
    saved: {
      icon: <Check className="size-3.5 text-[var(--sage)]" />,
      text: "saved",
      className: "text-[var(--sage)]",
    },
    error: {
      icon: <TriangleAlert className="size-3.5 text-[var(--destructive)]" />,
      text: error ?? "Couldn't save your diet profile.",
      className: "text-[var(--destructive)]",
    },
  }[state];

  return (
    <>
      {content.icon}
      <span
        role={state === "error" ? "alert" : undefined}
        className={cn("rt-mono", content.className)}
      >
        {content.text}
      </span>
    </>
  );
}

function CheckDot({ active }: Readonly<{ active: boolean }>) {
  return (
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
  );
}

function SelectableTile({
  active,
  children,
  className,
  label,
  onClick,
}: Readonly<{
  active: boolean;
  children: ReactNode;
  className?: string;
  label: string;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
        active
          ? "border-[var(--terracotta)] bg-[var(--butter-soft)]"
          : "border-[var(--line)] bg-[var(--card)] hover:border-[var(--line-strong)]",
        className,
      )}
    >
      <CheckDot active={active} />
      <span className="min-w-0">
        <span className="rt-body block font-semibold text-[var(--ink)]">
          {label}
        </span>
        {children}
      </span>
    </button>
  );
}

function IngredientBadge({
  ingredient,
  onRemove,
}: Readonly<{
  ingredient: DietIngredientOption;
  onRemove: () => void;
}>) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--terracotta)] bg-[var(--butter-soft)] px-3 py-1 text-[0.85rem] text-[var(--ink)]">
      <span className="truncate">{ingredient.name}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${ingredient.name}`}
        className="rounded-full text-[var(--terracotta-deep)] hover:bg-[var(--paper-warm)]"
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}

function IngredientPicker({
  ingredients,
  onAdd,
  selectedSlugs,
}: Readonly<{
  ingredients: DietIngredientOption[];
  onAdd: (ingredient: DietIngredientOption) => void;
  selectedSlugs: string[];
}>) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);
  const matches = useMemo(() => {
    const normalized = normalizeQuery(query);
    return ingredients
      .filter((ingredient) => !selected.has(ingredient.slug))
      .filter((ingredient) => {
        if (!normalized) return true;
        return `${ingredient.name} ${ingredient.category ?? ""}`
          .toLowerCase()
          .includes(normalized);
      })
      .slice(0, INGREDIENT_RESULT_LIMIT);
  }, [ingredients, query, selected]);

  function addIngredient(ingredient: DietIngredientOption) {
    onAdd(ingredient);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative max-w-lg">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--ink-3)]" />
      <Input
        value={query}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={`Search ${ingredients.length} canonical ingredients...`}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-label="Search canonical ingredients to exclude"
        className="bg-[var(--card)] pl-9"
      />
      {open && (
        <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-lg border border-[var(--line-strong)] bg-[var(--card)] p-2 shadow-lg">
          {matches.length > 0 ? (
            matches.map((ingredient) => (
              <button
                key={ingredient.slug}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addIngredient(ingredient)}
                className="flex w-full min-w-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-[var(--butter-soft)]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[var(--ink)]">
                    {ingredient.name}
                  </span>
                  <span className="rt-mono block truncate text-[var(--ink-3)]">
                    {ingredient.category ?? "ingredient"}
                  </span>
                </span>
                <Plus className="size-4 shrink-0 text-[var(--terracotta)]" />
              </button>
            ))
          ) : (
            <p className="rt-body px-3 py-2 text-sm text-[var(--ink-3)]">
              No canonical ingredients match that search.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function DietPanel({
  ingredients,
}: Readonly<{
  ingredients: DietIngredientOption[];
}>) {
  const [profile, setProfile] = useState<DietProfile>(emptyDietProfile);
  const [savedProfile, setSavedProfile] =
    useState<DietProfile>(emptyDietProfile);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const ingredientBySlug = useMemo(
    () =>
      new Map(ingredients.map((ingredient) => [ingredient.slug, ingredient])),
    [ingredients],
  );

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
  const selectedIngredients = profile.excludedIngredientSlugs.map((slug) => {
    return (
      ingredientBySlug.get(slug) ?? {
        slug,
        name: labelFromSlug(slug),
      }
    );
  });

  function updateProfile(next: DietProfile) {
    setProfile(next);
    setSaveState("idle");
    setError(null);
  }

  function addIngredient(ingredient: DietIngredientOption) {
    updateProfile({
      ...profile,
      excludedIngredientSlugs: unique([
        ...profile.excludedIngredientSlugs,
        ingredient.slug,
      ]),
    });
  }

  function removeIngredient(slug: string) {
    updateProfile({
      ...profile,
      excludedIngredientSlugs: profile.excludedIngredientSlugs.filter(
        (ingredient) => ingredient !== slug,
      ),
    });
  }

  function setMode(recipeMatchMode: DietRecipeMatchMode) {
    updateProfile({ ...profile, recipeMatchMode });
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
            <SectionLabel>DIETARY CHOICES</SectionLabel>
            <div className="grid gap-2 sm:grid-cols-2">
              {DIET_PRESETS.map((preset) => (
                <SelectableTile
                  key={preset.key}
                  active={profile.presetDietKeys.includes(preset.key)}
                  className="min-h-20"
                  label={preset.label}
                  onClick={() =>
                    updateProfile({
                      ...profile,
                      presetDietKeys: toggleValue(
                        profile.presetDietKeys,
                        preset.key,
                      ),
                    })
                  }
                >
                  <span className="rt-mono mt-1 block text-[var(--ink-4)]">
                    {preset.sub}
                  </span>
                </SelectableTile>
              ))}
            </div>
          </section>

          <section className="mb-7">
            <SectionLabel>GROUPS TO EXCLUDE OR WARN ON</SectionLabel>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {EXCLUSION_GROUPS.map((group) => {
                const coveredByPreset = profile.presetDietKeys.some((key) =>
                  presetByKey.get(key)?.excludedGroupKeys.includes(group.key),
                );
                return (
                  <SelectableTile
                    key={group.key}
                    active={profile.excludedGroupKeys.includes(group.key)}
                    label={group.label}
                    onClick={() =>
                      updateProfile({
                        ...profile,
                        excludedGroupKeys: toggleValue(
                          profile.excludedGroupKeys,
                          group.key,
                        ),
                      })
                    }
                  >
                    <span className="rt-mono mt-0.5 block text-[var(--ink-4)]">
                      {group.sub}
                      {coveredByPreset && (
                        <span className="mt-0.5 block font-semibold text-[var(--sage)]">
                          covered by preset
                        </span>
                      )}
                    </span>
                  </SelectableTile>
                );
              })}
            </div>
          </section>

          <section className="mb-7">
            <SectionLabel>SPECIFIC INGREDIENTS</SectionLabel>
            <IngredientPicker
              ingredients={ingredients}
              onAdd={addIngredient}
              selectedSlugs={profile.excludedIngredientSlugs}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedIngredients.length > 0 ? (
                selectedIngredients.map((ingredient) => (
                  <IngredientBadge
                    key={ingredient.slug}
                    ingredient={ingredient}
                    onRemove={() => removeIngredient(ingredient.slug)}
                  />
                ))
              ) : (
                <p className="rt-mono text-[var(--ink-4)]">
                  Pick ingredients from the canonical recipe catalog.
                </p>
              )}
            </div>
          </section>

          <section className="mb-7">
            <SectionLabel>WHEN A RECIPE BREAKS YOUR DIET</SectionLabel>
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
                    aria-pressed={active}
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
