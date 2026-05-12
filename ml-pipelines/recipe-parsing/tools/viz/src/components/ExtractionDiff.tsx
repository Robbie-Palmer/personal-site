import type { ExtractionRecipe } from "../types/extraction";

interface ExtractionDiffProps {
  expected: ExtractionRecipe;
  predicted: ExtractionRecipe;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

const SCALAR_FIELDS: { key: keyof ExtractionRecipe; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "description", label: "Description" },
  { key: "cuisine", label: "Cuisine" },
  { key: "servings", label: "Servings" },
  { key: "prepTime", label: "Prep Time" },
  { key: "cookTime", label: "Cook Time" },
];

function formatScalarValue(value: ExtractionRecipe[keyof ExtractionRecipe]): string | undefined {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : undefined;
  }
  return typeof value === "string" ? value : undefined;
}

function ScalarRow({
  label,
  expected,
  predicted,
}: {
  label: string;
  expected: string | undefined;
  predicted: string | undefined;
}) {
  const match =
    normalize(expected ?? "") === normalize(predicted ?? "");
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-gray-400 w-24 shrink-0 text-xs">{label}</span>
      <span className="flex-1">
        {expected ?? <span className="text-gray-300">&mdash;</span>}
      </span>
      <span
        className={`flex-1 ${!match ? "bg-red-50 text-red-800 px-1 rounded" : ""}`}
      >
        {predicted ?? <span className="text-gray-300">&mdash;</span>}
      </span>
    </div>
  );
}

function diffLines(
  expectedLines: string[],
  predictedLines: string[],
): {
  expectedStatuses: ("matched" | "missing")[];
  predictedStatuses: ("matched" | "extra")[];
} {
  const normalizedPredicted = new Map<string, number[]>();
  for (let i = 0; i < predictedLines.length; i++) {
    const key = normalize(predictedLines[i]);
    const existing = normalizedPredicted.get(key);
    if (existing) existing.push(i);
    else normalizedPredicted.set(key, [i]);
  }

  const expectedStatuses: ("matched" | "missing")[] = [];
  const predictedMatched = new Set<number>();

  for (const line of expectedLines) {
    const key = normalize(line);
    const indices = normalizedPredicted.get(key);
    if (indices && indices.length > 0) {
      predictedMatched.add(indices.shift()!);
      if (indices.length === 0) normalizedPredicted.delete(key);
      expectedStatuses.push("matched");
    } else {
      expectedStatuses.push("missing");
    }
  }

  const predictedStatuses: ("matched" | "extra")[] = predictedLines.map(
    (_, i) => (predictedMatched.has(i) ? "matched" : "extra"),
  );

  return { expectedStatuses, predictedStatuses };
}

function LineDiffSection({
  title,
  expectedLines,
  predictedLines,
}: {
  title: string;
  expectedLines: string[];
  predictedLines: string[];
}) {
  const { expectedStatuses, predictedStatuses } = diffLines(
    expectedLines,
    predictedLines,
  );

  const missingCount = expectedStatuses.filter((s) => s === "missing").length;
  const extraCount = predictedStatuses.filter((s) => s === "extra").length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h4 className="font-semibold text-sm">{title}</h4>
        {missingCount > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">
            {missingCount} missing
          </span>
        )}
        {extraCount > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
            {extraCount} extra
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
            Expected
          </div>
          <ul className="space-y-0.5">
            {expectedLines.map((line, i) => (
              <li
                key={i}
                className={`text-sm px-2 py-0.5 rounded ${
                  expectedStatuses[i] === "missing"
                    ? "bg-red-50 text-red-900"
                    : ""
                }`}
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
            Predicted
          </div>
          <ul className="space-y-0.5">
            {predictedLines.map((line, i) => (
              <li
                key={i}
                className={`text-sm px-2 py-0.5 rounded ${
                  predictedStatuses[i] === "extra"
                    ? "bg-yellow-50 text-yellow-900"
                    : ""
                }`}
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function ExtractionDiff({
  expected,
  predicted,
}: ExtractionDiffProps) {
  // Flatten all ingredient lines from all groups, including group names
  const flattenIngredientGroups = (groups: ExtractionRecipe["ingredientGroups"]) =>
    groups.flatMap((g) => [...(g.name ? [g.name] : []), ...g.lines]);
  const expectedIngredientLines = flattenIngredientGroups(expected.ingredientGroups);
  const predictedIngredientLines = flattenIngredientGroups(predicted.ingredientGroups);

  return (
    <div className="space-y-4">
      {/* Scalar fields */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-2 text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
          <span className="w-24 shrink-0" />
          <span className="flex-1">Expected</span>
          <span className="flex-1">Predicted</span>
        </div>
        <div className="space-y-1.5">
          {SCALAR_FIELDS.map(({ key, label }) => (
            <ScalarRow
              key={key}
              label={label}
              expected={formatScalarValue(expected[key])}
              predicted={formatScalarValue(predicted[key])}
            />
          ))}
        </div>
      </div>

      {/* Ingredients diff */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <LineDiffSection
          title="Ingredients"
          expectedLines={expectedIngredientLines}
          predictedLines={predictedIngredientLines}
        />
      </div>

      {/* Instructions diff */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <LineDiffSection
          title="Instructions"
          expectedLines={expected.instructions}
          predictedLines={predicted.instructions}
        />
      </div>
    </div>
  );
}
