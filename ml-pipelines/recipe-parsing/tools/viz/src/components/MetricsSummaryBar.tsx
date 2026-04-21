import type { HeadlineMetrics } from "../types/review";
import { formatPercent } from "../lib/scores";
import { ScoreBadge } from "./ScoreBadge";

interface MetricsSummaryBarProps {
  metrics: HeadlineMetrics;
  inferFailuresCount: number;
}

export function MetricsSummaryBar({
  metrics,
  inferFailuresCount,
}: MetricsSummaryBarProps) {
  const items = [
    { label: "Overall", value: metrics.overallScore },
    { label: "Ingredients F1", value: metrics.ingredientParsingF1 },
    { label: "Instructions F1", value: metrics.instructionsF1 },
    { label: "Cuisine", value: metrics.cuisineAccuracy },
    { label: "Servings", value: metrics.servingsAccuracy },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white rounded-lg border border-gray-200 p-4"
        >
          <div className="text-xs text-gray-500 mb-1">{item.label}</div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatPercent(item.value)}
          </div>
          <ScoreBadge score={item.value} />
        </div>
      ))}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="text-xs text-gray-500 mb-1">Infer Failures</div>
        <div className="text-2xl font-semibold tabular-nums">
          {inferFailuresCount}
        </div>
        <span
          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${inferFailuresCount === 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
        >
          {inferFailuresCount === 0 ? "none" : "failed"}
        </span>
      </div>
    </div>
  );
}
