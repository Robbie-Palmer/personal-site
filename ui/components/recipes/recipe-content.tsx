"use client";

import {
  AlertTriangle,
  Check,
  Clock,
  Loader2,
  Minus,
  Plus,
  Timer,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InlineTimer } from "@/components/recipes/inline-timer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useScaledRecipe } from "@/hooks/use-scaled-recipe";
import { useUnitPreference } from "@/hooks/use-unit-preference";
import {
  formatIngredientName,
  getDisplayedScaledAmount,
} from "@/lib/domain/recipe/ingredientText";
import {
  type InstructionDisplayToken,
  tokenizeInstructionSdk,
} from "@/lib/domain/recipe/instructionTokens";
import type {
  IngredientGroupView,
  RecipeDetailView,
  RecipeIngredientView,
} from "@/lib/domain/recipe/recipeViews";
import {
  convertToSystem,
  MEASUREMENT_SYSTEM_LABELS,
  type MeasurementSystem,
  UNIT_LABELS,
} from "@/lib/domain/recipe/unit";
import { normalizeSlug } from "@/lib/generic/slugs";

type IngredientAnnotation = Pick<RecipeIngredientView, "preparation" | "note">;

function buildIngredientAnnotationMap(
  ingredientGroups: IngredientGroupView[],
): Map<string, IngredientAnnotation> {
  const annotations = new Map<string, IngredientAnnotation>();

  for (const group of ingredientGroups) {
    for (const item of group.items) {
      const annotation = {
        preparation: item.preparation,
        note: item.note,
      };
      annotations.set(item.ingredient, annotation);
      const normalized = normalizeSlug(item.name);
      if (normalized && normalized !== item.ingredient) {
        annotations.set(normalized, annotation);
      }
    }
  }

  return annotations;
}

function hasAnnotation(a: IngredientAnnotation): boolean {
  return a.preparation != null || a.note != null;
}

function resolveIngredientAnnotation(
  item: RecipeIngredientView,
  annotations: Map<string, IngredientAnnotation>,
): IngredientAnnotation {
  const fromIngredientSlug = annotations.get(item.ingredient);
  if (fromIngredientSlug && hasAnnotation(fromIngredientSlug)) {
    return fromIngredientSlug;
  }

  const parsedNameSlug = normalizeSlug(item.name);
  const fromParsedName = annotations.get(parsedNameSlug);
  if (fromParsedName && hasAnnotation(fromParsedName)) {
    return fromParsedName;
  }

  return {};
}

function formatScaled(value: number): string {
  return getDisplayedScaledAmount(value, 1)?.toString() ?? "";
}

const SINGULAR_EPSILON = 1e-9;

/** Apply scale + system conversion, returning the best display (amount, unit). */
function resolveDisplay(
  item: Pick<RecipeIngredientView, "amount" | "unit">,
  scale: number,
  system: MeasurementSystem,
): { amount: number | undefined; unit: RecipeIngredientView["unit"] } {
  const scaledAmount = item.amount != null ? item.amount * scale : undefined;
  if (scaledAmount != null && item.unit) {
    const converted = convertToSystem(scaledAmount, item.unit, system);
    if (converted) return converted;
  }
  return { amount: scaledAmount, unit: item.unit };
}

function formatAmount(
  item: Pick<RecipeIngredientView, "amount" | "unit">,
  scale: number,
  system: MeasurementSystem,
): string {
  const { amount, unit } = resolveDisplay(item, scale, system);
  const parts: string[] = [];

  if (amount != null) {
    parts.push(formatScaled(amount));
  }

  if (unit) {
    const labels = UNIT_LABELS[unit];
    if (labels) {
      const isPlural =
        amount != null && Math.abs(amount) > 1 + SINGULAR_EPSILON;
      const label = isPlural ? labels.plural : labels.singular;
      if (label) {
        if (labels.noSpace && parts.length > 0) {
          parts[parts.length - 1] += label;
        } else {
          parts.push(label);
        }
      }
    }
  }

  return parts.join(" ");
}

function hasRenderedUnitLabel(
  item: Pick<RecipeIngredientView, "amount" | "unit">,
  scale: number,
  system: MeasurementSystem,
): boolean {
  const { amount, unit } = resolveDisplay(item, scale, system);
  if (!unit || unit === "piece") return false;
  const labels = UNIT_LABELS[unit];
  if (!labels) return false;
  const isPlural = amount != null && Math.abs(amount) > 1 + SINGULAR_EPSILON;
  return Boolean(isPlural ? labels.plural : labels.singular);
}

function formatIngredient(
  item: RecipeIngredientView,
  scale: number,
  system: MeasurementSystem,
  annotation?: IngredientAnnotation,
): string {
  const isPiece = item.unit === "piece";
  const amount = isPiece
    ? item.amount != null
      ? formatScaled(item.amount * scale)
      : ""
    : formatAmount(item, scale, system);
  const parts: string[] = [];

  if (amount) {
    parts.push(amount);
    if (hasRenderedUnitLabel(item, scale, system)) {
      parts.push("of");
    }
  }

  parts.push(formatIngredientName(item, scale));

  const effectivePreparation = item.preparation ?? annotation?.preparation;
  const effectiveNote = item.note ?? annotation?.note;

  if (effectivePreparation) {
    parts.push(`(${effectivePreparation})`);
  }

  if (effectiveNote) {
    parts.push(`\u2013 ${effectiveNote}`);
  }

  return parts.join(" ");
}

function formatInstructionIngredientToken(
  token: Extract<InstructionDisplayToken, { type: "ingredient" }>,
  scale: number,
  system: MeasurementSystem,
): string {
  const item = {
    ingredient: token.canonicalName,
    name: token.value,
    unit: token.unit as RecipeIngredientView["unit"],
    amount: token.amount ?? undefined,
  } satisfies RecipeIngredientView;
  const isPiece = item.unit === "piece";
  const amount = isPiece
    ? item.amount != null
      ? formatScaled(item.amount * scale)
      : ""
    : formatAmount(item, scale, system);
  const parts: string[] = [];

  if (amount) {
    parts.push(amount);
    if (hasRenderedUnitLabel(item, scale, system)) {
      parts.push("of");
    }
  }

  parts.push(formatIngredientName(item, scale));
  return parts.join(" ");
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function IngredientGroup({
  group,
  scale,
  system,
  annotations,
  checked,
  onToggle,
}: {
  group: IngredientGroupView;
  scale: number;
  system: MeasurementSystem;
  annotations: Map<string, IngredientAnnotation>;
  checked: Set<string>;
  onToggle: (ingredient: string) => void;
}) {
  return (
    <div>
      {group.name && (
        <h3 className="font-semibold text-lg mb-2">{group.name}</h3>
      )}
      <ul className="space-y-1">
        {group.items.map((item) => {
          const isChecked = checked.has(item.ingredient);
          return (
            <li key={item.ingredient} className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => onToggle(item.ingredient)}
                aria-checked={isChecked}
                role="checkbox"
                aria-label={item.name}
                className={[
                  "mt-0.5 h-4 w-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isChecked
                    ? "bg-muted-foreground border-muted-foreground"
                    : "border-muted-foreground/40 hover:border-muted-foreground",
                ].join(" ")}
              >
                {isChecked && <Check className="h-2.5 w-2.5 text-background" strokeWidth={3} />}
              </button>
              <span className={isChecked ? "line-through text-muted-foreground/60" : ""}>
                {formatIngredient(
                  item,
                  scale,
                  system,
                  resolveIngredientAnnotation(item, annotations),
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function RecipeContent({ recipe }: { recipe: RecipeDetailView }) {
  const baseServings = Math.max(1, recipe.servings);
  const [portions, setPortions] = useState(baseServings);
  const requestedScale = portions / baseServings;
  const {
    view: effectiveRecipe,
    scaleMultiplier: scale,
    isScaling,
    error: scalingError,
  } = useScaledRecipe(recipe, requestedScale);
  const [unitSystem, setUnitSystem] = useUnitPreference();

  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(
    () => new Set(),
  );

  const toggleIngredient = useCallback((ingredient: string) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(ingredient)) {
        next.delete(ingredient);
      } else {
        next.add(ingredient);
      }
      return next;
    });
  }, []);
  useEffect(() => {
    if (scalingError) {
      console.error(
        `[RecipeContent] cooklang-rs scaling failed for "${recipe.slug}" at ${requestedScale}x; falling back to JS scaling.`,
        scalingError,
      );
    }
  }, [scalingError, recipe.slug, requestedScale]);
  const ingredientAnnotations = useMemo(
    () => buildIngredientAnnotationMap(effectiveRecipe.ingredientGroups),
    [effectiveRecipe.ingredientGroups],
  );

  const instructionTokenization = useMemo(
    () =>
      effectiveRecipe.instructionSdk
        ? tokenizeInstructionSdk(effectiveRecipe.instructionSdk)
        : null,
    [effectiveRecipe.instructionSdk],
  );
  const shouldUseSdkInstructions = instructionTokenization?.ok === true;

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      effectiveRecipe.instructionSdk &&
      instructionTokenization?.ok === false
    ) {
      console.debug(
        `[RecipeContent] Falling back to canonical instructions for "${effectiveRecipe.slug}": ${instructionTokenization.reason}`,
      );
    }
  }, [
    effectiveRecipe.instructionSdk,
    effectiveRecipe.slug,
    instructionTokenization,
  ]);

  return (
    <>
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{recipe.title}</h1>
        <p className="text-xl text-muted-foreground mb-4">
          {recipe.description}
        </p>

        {recipe.canonical && (
          <p className="text-sm text-muted-foreground italic mb-4">
            Adapted from{" "}
            <a
              href={recipe.canonical}
              target="_blank"
              rel="noopener"
              className="underline hover:text-foreground"
            >
              the original recipe
            </a>
            .
          </p>
        )}

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPortions((p) => Math.max(1, p - 1))}
                disabled={portions <= 1}
                aria-label="Decrease portions"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="min-w-[4ch] text-center tabular-nums">
                {portions} {portions === 1 ? "serving" : "servings"}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPortions((p) => p + 1)}
                aria-label="Increase portions"
              >
                <Plus className="h-3 w-3" />
              </Button>
              {scalingError ? (
                <AlertTriangle
                  className="h-3 w-3 text-destructive"
                  aria-label="Precise scaling unavailable; showing an approximation"
                />
              ) : isScaling ? (
                <Loader2
                  className="h-3 w-3 animate-spin text-muted-foreground"
                  aria-label="Scaling recipe"
                />
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs">Units:</span>
            <div className="flex items-center rounded border">
              {(["metric", "us", "uk"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setUnitSystem(s)}
                  className={[
                    "px-2 py-0.5 text-xs font-medium transition-colors first:rounded-l last:rounded-r",
                    unitSystem === s
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                  aria-pressed={unitSystem === s}
                >
                  {MEASUREMENT_SYSTEM_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          {recipe.prepTime != null && (
            <div className="flex items-center gap-1">
              <Timer className="h-4 w-4" />
              <span>Prep: {formatTime(recipe.prepTime)}</span>
            </div>
          )}
          {recipe.cookTime != null && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>Cook: {formatTime(recipe.cookTime)}</span>
            </div>
          )}
          {recipe.totalTime != null && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>Total: {formatTime(recipe.totalTime)}</span>
            </div>
          )}
        </div>

        {recipe.cuisine.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {recipe.cuisine.map((c) => (
              <Badge key={c} variant="secondary">
                {c}
              </Badge>
            ))}
          </div>
        )}
      </header>

      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-2xl font-bold">Ingredients</h2>
          {checkedIngredients.size > 0 && (
            <button
              type="button"
              onClick={() => setCheckedIngredients(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset
            </button>
          )}
        </div>
        <div className="space-y-4">
          {effectiveRecipe.ingredientGroups.map((group, i) => (
            <IngredientGroup
              key={group.name ?? i}
              group={group}
              scale={scale}
              system={unitSystem}
              annotations={ingredientAnnotations}
              checked={checkedIngredients}
              onToggle={toggleIngredient}
            />
          ))}
        </div>
      </section>

      {effectiveRecipe.cookware.length > 0 && (
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Equipment</h2>
          <ul className="space-y-1">
            {effectiveRecipe.cookware.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-muted-foreground mt-1.5 h-1.5 w-1.5 rounded-full bg-current flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-2xl font-bold mb-4">Instructions</h2>
        <ol className="space-y-3 list-decimal list-inside">
          {shouldUseSdkInstructions
            ? instructionTokenization.steps.map((tokens, i) => (
                <li key={i} className="leading-relaxed pl-2">
                  {tokens.map((token, tokenIndex) => (
                    <span key={tokenIndex}>
                      {token.type === "timer" ? (
                        <InlineTimer
                          durationSeconds={token.durationSeconds}
                          label={token.value}
                        />
                      ) : token.type === "ingredient" ? (
                        formatInstructionIngredientToken(
                          token,
                          scale,
                          unitSystem,
                        )
                      ) : (
                        token.value
                      )}
                    </span>
                  ))}
                </li>
              ))
            : effectiveRecipe.instructions.map((step, i) => (
                <li key={i} className="leading-relaxed pl-2">
                  {step}
                </li>
              ))}
        </ol>
      </section>
    </>
  );
}
