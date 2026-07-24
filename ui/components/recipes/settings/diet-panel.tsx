"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type DietGroupOption,
  type DietIngredientOption,
  type DietOptions,
  type DietPresetOption,
  type DietProfile,
  type DietRecipeMatchMode,
  emptyDietOptions,
  emptyDietProfile,
} from "@/lib/api/diet";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/generic/styles";
import { saveDietProfileMutation } from "@/lib/query/recipe-mutations";
import { dietOptionsQuery, dietProfileQuery } from "@/lib/query/recipe-queries";
import { PanelHead } from "./panel-head";

type SaveState = "idle" | "saving" | "saved" | "error";

const INGREDIENT_RESULT_LIMIT = 8;

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

function sortAlphabetically(values: string[]): string[] {
  return [...values].sort((first, second) => first.localeCompare(second));
}

function serialize(profile: DietProfile): string {
  return JSON.stringify({
    ...profile,
    presetDietKeys: sortAlphabetically(profile.presetDietKeys),
    excludedIngredientSlugs: sortAlphabetically(
      profile.excludedIngredientSlugs,
    ),
    excludedGroupKeys: sortAlphabetically(profile.excludedGroupKeys),
  });
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}

function summarise(
  profile: DietProfile,
  presetByKey: Map<string, DietPresetOption>,
) {
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

function effectiveExclusions(
  profile: DietProfile,
  presetByKey: Map<string, DietPresetOption>,
) {
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

function EmptyCatalogMessage({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--paper-warm)] px-4 py-3">
      <p className="rt-body text-sm text-[var(--ink-3)]">{children}</p>
    </div>
  );
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
  disabled = false,
  label,
  onClick,
}: Readonly<{
  active: boolean;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
        active
          ? "border-[var(--terracotta)] bg-[var(--butter-soft)]"
          : "border-[var(--line)] bg-[var(--card)] hover:border-[var(--line-strong)]",
        disabled && "cursor-default",
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
  const closeTimeoutRef = useRef<number | null>(null);
  const hasIngredients = ingredients.length > 0;
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

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  function cancelScheduledClose() {
    if (closeTimeoutRef.current === null) return;
    window.clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = null;
  }

  function scheduleClose() {
    cancelScheduledClose();
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimeoutRef.current = null;
    }, 120);
  }

  function addIngredient(ingredient: DietIngredientOption) {
    cancelScheduledClose();
    onAdd(ingredient);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative max-w-lg">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--ink-3)]" />
      <Input
        value={query}
        disabled={!hasIngredients}
        onBlur={scheduleClose}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          cancelScheduledClose();
          setOpen(true);
        }}
        placeholder={
          hasIngredients
            ? `Search ${ingredients.length} canonical ingredients...`
            : "No canonical ingredients have been seeded yet"
        }
        aria-autocomplete="list"
        aria-expanded={hasIngredients && open}
        aria-label="Search canonical ingredients to exclude"
        className="bg-[var(--card)] pl-9"
      />
      {hasIngredients && open && (
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

function dietPanelError(
  saveError: string | null,
  loadError: unknown,
): string | null {
  if (saveError) return saveError;
  if (loadError instanceof Error) return loadError.message;
  if (loadError) return "Couldn't load your diet profile.";
  return null;
}

function dietPanelSaveState(
  mutation: {
    isError: boolean;
    isPending: boolean;
    isSuccess: boolean;
  },
  loadError: unknown,
): SaveState {
  if (mutation.isPending) return "saving";
  if (mutation.isError || loadError) return "error";
  if (mutation.isSuccess) return "saved";
  return "idle";
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function useDietPanelState() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<DietProfile>(emptyDietProfile);
  const [savedProfile, setSavedProfile] =
    useState<DietProfile>(emptyDietProfile);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const profileResult = useQuery({
    ...dietProfileQuery(userId ?? "pending"),
    enabled: !sessionPending && Boolean(userId),
  });
  const optionsResult = useQuery({
    ...dietOptionsQuery(userId ?? "pending"),
    enabled: !sessionPending && Boolean(userId),
  });
  const options: DietOptions = optionsResult.data ?? emptyDietOptions;
  const saveMutation = useMutation(
    saveDietProfileMutation(queryClient, userId ?? "pending"),
  );
  const resetSaveMutation = saveMutation.reset;
  const ingredientBySlug = useMemo(
    () =>
      new Map(
        options.ingredients.map((ingredient) => [ingredient.slug, ingredient]),
      ),
    [options.ingredients],
  );
  const presetByKey = useMemo(
    () => new Map(options.presets.map((preset) => [preset.key, preset])),
    [options.presets],
  );

  useEffect(() => {
    if (!userId) {
      if (loadedUserId !== null) {
        setProfile(emptyDietProfile);
        setSavedProfile(emptyDietProfile);
        setLoadedUserId(null);
        setSaveError(null);
        resetSaveMutation();
      }
      return;
    }
    if (!profileResult.data || loadedUserId === userId) return;
    setProfile(profileResult.data);
    setSavedProfile(profileResult.data);
    setLoadedUserId(userId);
    setSaveError(null);
    resetSaveMutation();
  }, [loadedUserId, profileResult.data, resetSaveMutation, userId]);

  const dirty = serialize(profile) !== serialize(savedProfile);
  const loading =
    sessionPending ||
    Boolean(userId && (profileResult.isPending || optionsResult.isPending));
  const loadError = profileResult.error ?? optionsResult.error;
  const error = dietPanelError(saveError, loadError);
  const saveState = dietPanelSaveState(saveMutation, loadError);
  const exclusions = useMemo(
    () => effectiveExclusions(profile, presetByKey),
    [presetByKey, profile],
  );
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
    setSaveError(null);
    resetSaveMutation();
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
    setSaveError(null);
    try {
      const saved = await saveMutation.mutateAsync(profile);
      setProfile(saved);
      setSavedProfile(saved);
    } catch (error) {
      setSaveError(errorMessage(error, "Couldn't save your diet profile."));
    }
  }

  return {
    addIngredient,
    dirty,
    error,
    exclusions,
    loading,
    options,
    presetByKey,
    profile,
    removeIngredient,
    save,
    saveState,
    selectedIngredients,
    setMode,
    updateProfile,
  };
}

export function DietPanel() {
  const {
    addIngredient,
    dirty,
    error,
    exclusions,
    loading,
    options,
    presetByKey,
    profile,
    removeIngredient,
    save,
    saveState,
    selectedIngredients,
    setMode,
    updateProfile,
  } = useDietPanelState();

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
            {summarise(profile, presetByKey)}
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
            {options.presets.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {options.presets.map((preset) => (
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
            ) : (
              <EmptyCatalogMessage>
                Diet presets will appear here once the database catalog has been
                seeded.
              </EmptyCatalogMessage>
            )}
          </section>

          <section className="mb-7">
            <SectionLabel>GROUPS TO EXCLUDE OR WARN ON</SectionLabel>
            {options.groups.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {options.groups.map((group: DietGroupOption) => {
                  const coveredByPreset = profile.presetDietKeys.some((key) =>
                    presetByKey.get(key)?.excludedGroupKeys.includes(group.key),
                  );
                  return (
                    <SelectableTile
                      key={group.key}
                      active={
                        coveredByPreset ||
                        profile.excludedGroupKeys.includes(group.key)
                      }
                      disabled={coveredByPreset}
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
            ) : (
              <EmptyCatalogMessage>
                Ingredient groups will appear here once the database catalog has
                been seeded.
              </EmptyCatalogMessage>
            )}
          </section>

          <section className="mb-7">
            <SectionLabel>SPECIFIC INGREDIENTS</SectionLabel>
            <IngredientPicker
              ingredients={options.ingredients}
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
