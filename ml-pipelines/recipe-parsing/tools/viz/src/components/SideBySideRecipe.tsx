import type { ReviewEntry } from "../types/review";
import { formatIngredient, formatTime } from "../lib/format";
import { IngredientRow, type DiffStatus } from "./IngredientRow";
import { InstructionStep } from "./InstructionStep";
import { IngredientDiffSummary } from "./IngredientDiffSummary";

interface SideBySideRecipeProps {
  entry: ReviewEntry;
}

function ScalarField({
  label,
  expected,
  predicted,
  match,
}: {
  label: string;
  expected: string | number | undefined;
  predicted?: string | number;
  match: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-gray-400 w-20 shrink-0 text-xs">{label}</span>
      <span className="flex-1">
        {expected != null ? String(expected) : <span className="text-gray-300">—</span>}
      </span>
      <span
        className={`flex-1 ${!match ? "bg-red-50 text-red-800 px-1 rounded" : ""}`}
      >
        {predicted != null ? (
          String(predicted)
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </span>
    </div>
  );
}

export function SideBySideRecipe({ entry }: SideBySideRecipeProps) {
  const { expectedRecipe, predictedRecipe, ingredients, instructions } = entry;

  // Build a set of ingredient slugs that have mismatches for quick lookup
  const amountMismatchSlugs = new Set(
    ingredients.amountMismatch.map((m) => m.expected.ingredient.ingredient),
  );
  const unitMismatchSlugs = new Set(
    ingredients.unitMismatch.map((m) => m.expected.ingredient.ingredient),
  );

  function getDiffStatus(slug: string): DiffStatus {
    if (amountMismatchSlugs.has(slug)) return "amount-mismatch";
    if (unitMismatchSlugs.has(slug)) return "unit-mismatch";
    return "matched";
  }

  return (
    <div className="space-y-6">
      {/* Scalar fields comparison */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-2 text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
          <span className="w-20 shrink-0" />
          <span className="flex-1">Expected</span>
          <span className="flex-1">Predicted</span>
        </div>
        <div className="space-y-1.5">
          {Object.entries(entry.scalarFields).map(([key, field]) => (
            <ScalarField
              key={key}
              label={key}
              expected={field.expected}
              predicted={field.predicted}
              match={field.match}
            />
          ))}
        </div>
      </div>

      {/* Ingredients diff */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-sm mb-3">Ingredients</h3>
        <IngredientDiffSummary diff={ingredients} />

        <div className="grid grid-cols-2 gap-4 mt-4">
          {/* Expected side */}
          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              Expected
            </div>
            <ul className="space-y-0.5">
              {ingredients.matched.map((m) => (
                <IngredientRow
                  key={m.expected.ingredient.ingredient}
                  ingredient={m.expected.ingredient}
                  diffStatus={getDiffStatus(m.expected.ingredient.ingredient)}
                  category={m.expected.category}
                />
              ))}
              {ingredients.missing.map((m) => (
                <IngredientRow
                  key={m.ingredient.ingredient}
                  ingredient={m.ingredient}
                  diffStatus="missing"
                  category={m.category}
                />
              ))}
            </ul>
          </div>

          {/* Predicted side */}
          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              Predicted
            </div>
            <ul className="space-y-0.5">
              {ingredients.matched.map((m) => (
                <IngredientRow
                  key={m.predicted.ingredient.ingredient}
                  ingredient={m.predicted.ingredient}
                  diffStatus={getDiffStatus(
                    m.predicted.ingredient.ingredient,
                  )}
                  category={m.predicted.category}
                />
              ))}
              {/* Gap for missing ingredients */}
              {ingredients.missing.map((m) => (
                <li
                  key={m.ingredient.ingredient}
                  className="text-sm px-2 py-0.5 text-gray-300 italic"
                >
                  — not predicted
                </li>
              ))}
              {ingredients.extra.map((m) => (
                <IngredientRow
                  key={m.ingredient.ingredient}
                  ingredient={m.ingredient}
                  diffStatus="extra"
                  category={m.category}
                />
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Instructions diff */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-sm mb-3">
          Instructions
          <span className="ml-2 text-xs font-normal text-gray-400">
            F1: {Math.round(instructions.overlap.f1 * 100)}%
          </span>
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              Expected
              {instructions.missingWords.length > 0 && (
                <span className="normal-case ml-1 text-red-400">
                  ({instructions.missingWords.length} missing words)
                </span>
              )}
            </div>
            <ol className="space-y-1">
              {instructions.expected.map((step, i) => (
                <InstructionStep
                  key={i}
                  text={step}
                  index={i}
                  highlightWords={instructions.missingWords}
                  highlightClass="bg-red-200 text-red-900 rounded px-0.5"
                />
              ))}
            </ol>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              Predicted
              {instructions.extraWords.length > 0 && (
                <span className="normal-case ml-1 text-yellow-600">
                  ({instructions.extraWords.length} extra words)
                </span>
              )}
            </div>
            <ol className="space-y-1">
              {instructions.predicted.map((step, i) => (
                <InstructionStep
                  key={i}
                  text={step}
                  index={i}
                  highlightWords={instructions.extraWords}
                  highlightClass="bg-yellow-200 text-yellow-900 rounded px-0.5"
                />
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
