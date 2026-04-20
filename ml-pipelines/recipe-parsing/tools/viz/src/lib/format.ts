import type { RecipeIngredient, Unit } from "recipe-domain";
import { UNIT_LABELS } from "recipe-domain";

function formatScaled(value: number): string {
  return parseFloat(value.toPrecision(2)).toString();
}

/** Humanize a slug like "olive-oil" to "olive oil" */
export function humanizeSlug(slug: string): string {
  return slug.replace(/-/g, " ");
}

export function formatAmount(item: RecipeIngredient, scale = 1): string {
  const parts: string[] = [];

  if (item.amount != null) {
    parts.push(formatScaled(item.amount * scale));
  }

  if (item.unit) {
    const labels = UNIT_LABELS[item.unit as Unit];
    if (labels) {
      const scaledAmount =
        item.amount != null ? item.amount * scale : undefined;
      const label =
        scaledAmount != null && scaledAmount !== 1
          ? labels.plural
          : labels.singular;
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

export function formatIngredient(item: RecipeIngredient, scale = 1): string {
  const isPiece = item.unit === "piece";
  const amount = isPiece
    ? item.amount != null
      ? formatScaled(item.amount * scale)
      : ""
    : formatAmount(item, scale);

  const parts: string[] = [];

  if (amount) {
    parts.push(amount);
  }

  parts.push(humanizeSlug(item.ingredient));

  if (item.preparation) {
    parts.push(`(${item.preparation})`);
  }

  if (item.note) {
    parts.push(`\u2013 ${item.note}`);
  }

  return parts.join(" ");
}

export function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
