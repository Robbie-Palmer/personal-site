import type { CategoryAggregate } from "../types/review";

interface CategoryAggregateTableProps {
  aggregates: CategoryAggregate[];
}

export function CategoryAggregateTable({
  aggregates,
}: CategoryAggregateTableProps) {
  const sorted = [...aggregates].sort(
    (a, b) => b.expectedCount - a.expectedCount,
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-4 py-2 font-medium text-gray-600">
              Category
            </th>
            <th className="text-right px-4 py-2 font-medium text-gray-600">
              Expected
            </th>
            <th className="text-right px-4 py-2 font-medium text-gray-600">
              Predicted
            </th>
            <th className="text-right px-4 py-2 font-medium text-gray-600">
              TP
            </th>
            <th className="text-right px-4 py-2 font-medium text-gray-600">
              FP
            </th>
            <th className="text-right px-4 py-2 font-medium text-gray-600">
              FN
            </th>
            <th className="text-right px-4 py-2 font-medium text-gray-600">
              Precision
            </th>
            <th className="text-right px-4 py-2 font-medium text-gray-600">
              Recall
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((cat) => {
            const precision =
              cat.truePositive + cat.falsePositive > 0
                ? cat.truePositive / (cat.truePositive + cat.falsePositive)
                : null;
            const recall =
              cat.truePositive + cat.falseNegative > 0
                ? cat.truePositive / (cat.truePositive + cat.falseNegative)
                : null;

            return (
              <tr
                key={cat.category}
                className="border-b border-gray-100 last:border-0"
              >
                <td className="px-4 py-2 font-medium">{cat.category}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {cat.expectedCount}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {cat.predictedCount}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-green-700">
                  {cat.truePositive}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-red-700">
                  {cat.falsePositive || ""}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-amber-700">
                  {cat.falseNegative || ""}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {precision != null ? `${Math.round(precision * 100)}%` : "\u2014"}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {recall != null ? `${Math.round(recall * 100)}%` : "\u2014"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
