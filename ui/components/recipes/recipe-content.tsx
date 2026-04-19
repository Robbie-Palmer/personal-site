"use client";

import { Clock, Minus, Plus, Timer, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { UNIT_LABELS } from "@/lib/domain/recipe/unit";
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

function selectUnitLabel(
  item: Pick<RecipeIngredientView, "amount" | "unit">,
  scale: number,
): string | undefined {
  if (!item.unit) {
    return undefined;
  }

  const labels = UNIT_LABELS[item.unit];
  if (!labels) {
    return undefined;
  }

  const scaledAmount = getDisplayedScaledAmount(item.amount, scale);
  const isPlural =
    scaledAmount != null && Math.abs(scaledAmount - 1) >= SINGULAR_EPSILON;
  return isPlural ? labels.plural : labels.singular;
}

function formatAmount(item: RecipeIngredientView, scale: number): string {
  const parts: string[] = [];

  if (item.amount != null) {
    parts.push(formatScaled(item.amount * scale));
  }

  if (item.unit) {
    const labels = UNIT_LABELS[item.unit];
    if (labels) {
      const label = selectUnitLabel(item, scale);
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
): boolean {
  if (!item.unit || item.unit === "piece") {
    return false;
  }

  const labels = UNIT_LABELS[item.unit];
  if (!labels) {
    return false;
  }

  return Boolean(selectUnitLabel(item, scale));
}

function formatIngredient(
  item: RecipeIngredientView,
  scale: number,
  annotation?: IngredientAnnotation,
): string {
  const isPiece = item.unit === "piece";
  const amount = isPiece
    ? item.amount != null
      ? formatScaled(item.amount * scale)
      : ""
    : formatAmount(item, scale);
  const parts: string[] = [];

  if (amount) {
    parts.push(amount);
    if (hasRenderedUnitLabel(item, scale)) {
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
    : formatAmount(item, scale);
  const parts: string[] = [];

  if (amount) {
    parts.push(amount);
    if (hasRenderedUnitLabel(item, scale)) {
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
  annotations,
}: {
  group: IngredientGroupView;
  scale: number;
  annotations: Map<string, IngredientAnnotation>;
}) {
  return (
    <div>
      {group.name && (
        <h3 className="font-semibold text-lg mb-2">{group.name}</h3>
      )}
      <ul className="space-y-1">
        {group.items.map((item) => (
          <li key={item.ingredient} className="flex items-start gap-2">
            <span className="text-muted-foreground mt-1.5 h-1.5 w-1.5 rounded-full bg-current flex-shrink-0" />
            <span>
              {formatIngredient(
                item,
                scale,
                resolveIngredientAnnotation(item, annotations),
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecipeContent({ recipe }: { recipe: RecipeDetailView }) {
  const baseServings = Math.max(1, recipe.servings);
  const [portions, setPortions] = useState(baseServings);
  const scale = portions / baseServings;
  const ingredientAnnotations = useMemo(
    () => buildIngredientAnnotationMap(recipe.ingredientGroups),
    [recipe.ingredientGroups],
  );

  const instructionTokenization = useMemo(
    () =>
      recipe.instructionSdk
        ? tokenizeInstructionSdk(recipe.instructionSdk)
        : null,
    [recipe.instructionSdk],
  );
  const shouldUseSdkInstructions = instructionTokenization?.ok === true;
  const repeatedInstructionIngredients = useMemo(() => {
    if (!shouldUseSdkInstructions) return new Set<string>();

    const counts = new Map<string, number>();
    for (const step of instructionTokenization.steps) {
      for (const token of step) {
        if (token.type !== "ingredient") continue;
        counts.set(
          token.canonicalName,
          (counts.get(token.canonicalName) ?? 0) + 1,
        );
      }
    }

    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([name]) => name),
    );
  }, [instructionTokenization, shouldUseSdkInstructions]);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      recipe.instructionSdk &&
      instructionTokenization?.ok === false
    ) {
      console.debug(
        `[RecipeContent] Falling back to canonical instructions for "${recipe.slug}": ${instructionTokenization.reason}`,
      );
    }
  }, [recipe.instructionSdk, recipe.slug, instructionTokenization]);

  return (
    <>
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{recipe.title}</h1>
        <p className="text-xl text-muted-foreground mb-4">
          {recipe.description}
        </p>

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

        {recipe.cuisine && (
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge variant="secondary">{recipe.cuisine}</Badge>
          </div>
        )}
      </header>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Ingredients</h2>
        <div className="space-y-4">
          {recipe.ingredientGroups.map((group, i) => (
            <IngredientGroup
              key={group.name ?? i}
              group={group}
              scale={scale}
              annotations={ingredientAnnotations}
            />
          ))}
        </div>
      </section>

      {recipe.cookware.length > 0 && (
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Equipment</h2>
          <ul className="space-y-1">
            {recipe.cookware.map((item) => (
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
                      {token.type === "ingredient" &&
                      repeatedInstructionIngredients.has(token.canonicalName)
                        ? formatInstructionIngredientToken(token, scale)
                        : token.value}
                    </span>
                  ))}
                </li>
              ))
            : recipe.instructions.map((step, i) => (
                <li key={i} className="leading-relaxed pl-2">
                  {step}
                </li>
              ))}
        </ol>
      </section>
    </>
  );
}
