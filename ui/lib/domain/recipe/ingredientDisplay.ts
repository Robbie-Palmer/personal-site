/**
 * Client-side ingredient display formatting shared by the recipe read view
 * and cook mode: scaling + unit-system conversion + annotation resolution,
 * rendered down to plain strings.
 */

import {
  formatIngredientName,
  getDisplayedScaledAmount,
} from "@/lib/domain/recipe/ingredientText";
import type { InstructionDisplayToken } from "@/lib/domain/recipe/instructionTokens";
import type {
  IngredientGroupView,
  RecipeIngredientView,
} from "@/lib/domain/recipe/recipeViews";
import {
  convertToSystem,
  type MeasurementSystem,
  UNIT_LABELS,
} from "@/lib/domain/recipe/unit";
import { normalizeSlug } from "@/lib/generic/slugs";

export type IngredientAnnotation = Pick<
  RecipeIngredientView,
  "preparation" | "note"
>;

export function buildIngredientAnnotationMap(
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

export function resolveIngredientAnnotation(
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
  const scaledAmount = item.amount == null ? undefined : item.amount * scale;
  if (scaledAmount != null && item.unit) {
    const converted = convertToSystem(scaledAmount, item.unit, system);
    if (converted) return converted;
  }
  return { amount: scaledAmount, unit: item.unit };
}

/** The pluralised unit label to render after the amount, if the unit has one. */
function unitLabelFor(
  amount: number | undefined,
  unit: RecipeIngredientView["unit"],
): { label: string; noSpace: boolean } | null {
  if (!unit) return null;
  const labels = UNIT_LABELS[unit];
  if (!labels) return null;
  const isPlural = amount != null && Math.abs(amount) > 1 + SINGULAR_EPSILON;
  const label = isPlural ? labels.plural : labels.singular;
  if (!label) return null;
  return { label, noSpace: Boolean(labels.noSpace) };
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

  const unitLabel = unitLabelFor(amount, unit);
  if (unitLabel) {
    if (unitLabel.noSpace && parts.length > 0) {
      parts[parts.length - 1] += unitLabel.label;
    } else {
      parts.push(unitLabel.label);
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
  return unitLabelFor(amount, unit) !== null;
}

/**
 * The rendered amount prefix: "piece" quantities are bare scaled numbers,
 * everything else goes through unit conversion and labelling.
 */
function amountText(
  item: Pick<RecipeIngredientView, "amount" | "unit">,
  scale: number,
  system: MeasurementSystem,
): string {
  if (item.unit !== "piece") {
    return formatAmount(item, scale, system);
  }
  if (item.amount == null) return "";
  return formatScaled(item.amount * scale);
}

export function formatIngredient(
  item: RecipeIngredientView,
  scale: number,
  system: MeasurementSystem,
  annotation?: IngredientAnnotation,
): string {
  const amount = amountText(item, scale, system);
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
    parts.push(`– ${effectiveNote}`);
  }

  return parts.join(" ");
}

export function formatInstructionIngredientToken(
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
  const amount = amountText(item, scale, system);
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
