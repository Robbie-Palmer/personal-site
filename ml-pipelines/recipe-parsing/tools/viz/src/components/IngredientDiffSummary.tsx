import type { IngredientDiff } from "../types/review";

interface IngredientDiffSummaryProps {
  diff: IngredientDiff;
}

export function IngredientDiffSummary({ diff }: IngredientDiffSummaryProps) {
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <span className="px-2 py-1 rounded bg-green-50 text-green-700">
        {diff.matched.length} matched
      </span>
      {diff.missing.length > 0 && (
        <span className="px-2 py-1 rounded bg-red-50 text-red-700">
          {diff.missing.length} missing
        </span>
      )}
      {diff.extra.length > 0 && (
        <span className="px-2 py-1 rounded bg-yellow-50 text-yellow-700">
          {diff.extra.length} extra
        </span>
      )}
      {diff.amountMismatch.length > 0 && (
        <span className="px-2 py-1 rounded bg-amber-50 text-amber-700">
          {diff.amountMismatch.length} amount mismatch
        </span>
      )}
      {diff.unitMismatch.length > 0 && (
        <span className="px-2 py-1 rounded bg-amber-50 text-amber-700">
          {diff.unitMismatch.length} unit mismatch
        </span>
      )}
    </div>
  );
}
