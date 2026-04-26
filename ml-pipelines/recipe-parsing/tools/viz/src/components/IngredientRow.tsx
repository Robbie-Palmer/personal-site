import type { RecipeIngredient } from "recipe-domain";
import { formatIngredient } from "../lib/format";

export type DiffStatus =
  | "matched"
  | "missing"
  | "extra"
  | "amount-mismatch"
  | "unit-mismatch";

interface IngredientRowProps {
  ingredient: RecipeIngredient;
  diffStatus?: DiffStatus;
  category?: string;
}

const DIFF_STYLES: Record<DiffStatus, string> = {
  matched: "",
  missing: "bg-red-50 text-red-800 line-through",
  extra: "bg-yellow-50 text-yellow-800",
  "amount-mismatch": "bg-amber-50 text-amber-800",
  "unit-mismatch": "bg-amber-50 text-amber-800",
};

const CATEGORY_COLORS: Record<string, string> = {
  protein: "bg-rose-100 text-rose-700",
  vegetable: "bg-green-100 text-green-700",
  fruit: "bg-orange-100 text-orange-700",
  herb: "bg-emerald-100 text-emerald-700",
  dairy: "bg-sky-100 text-sky-700",
  grain: "bg-yellow-100 text-yellow-700",
  spice: "bg-purple-100 text-purple-700",
  condiment: "bg-pink-100 text-pink-700",
  "oil-fat": "bg-amber-100 text-amber-700",
  liquid: "bg-blue-100 text-blue-700",
  other: "bg-gray-100 text-gray-700",
  unknown: "bg-red-100 text-red-700",
};

export function IngredientRow({
  ingredient,
  diffStatus = "matched",
  category,
}: IngredientRowProps) {
  return (
    <li
      className={`text-sm flex items-start gap-1.5 px-2 py-0.5 rounded ${DIFF_STYLES[diffStatus]}`}
    >
      <span className="text-gray-300 mt-1.5 h-1 w-1 rounded-full bg-current shrink-0" />
      <span className="flex-1">{formatIngredient(ingredient)}</span>
      {category && (
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other}`}
        >
          {category}
        </span>
      )}
    </li>
  );
}
