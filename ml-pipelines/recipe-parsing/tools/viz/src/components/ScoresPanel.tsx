import type { EntryScores } from "../types/review";
import { ScoreBadge } from "./ScoreBadge";
import { scoreBarColor } from "../lib/scores";

interface ScoresPanelProps {
  scores: EntryScores;
}

export function ScoresPanel({ scores }: ScoresPanelProps) {
  const items = [
    { label: "Structured Score", value: scores.overall },
    { label: "Scalar Fields", value: scores.scalarFields },
    { label: "Ingredients", value: scores.ingredientParsing },
    { label: "Instructions", value: scores.instructions },
    ...(scores.equipmentParsing != null
      ? [{ label: "Equipment", value: scores.equipmentParsing }]
      : []),
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold mb-1">Structured Score</h3>
      <p className="mb-3 text-xs text-gray-500">
        Composite over scalar fields, ingredients, equipment, and instructions.
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-24 shrink-0">
              {item.label}
            </span>
            <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${scoreBarColor(item.value)}`}
                style={{ width: `${item.value * 100}%` }}
              />
            </div>
            <ScoreBadge score={item.value} />
          </div>
        ))}
      </div>
    </div>
  );
}
