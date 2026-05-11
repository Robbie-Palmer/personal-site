import type { ManifestEntry } from "../types/review";
import { imageUrl } from "../lib/data";
import { ScoreBadge } from "./ScoreBadge";
import { scoreBarColor } from "../lib/scores";

interface EntryCardProps {
  entry: ManifestEntry;
  onClick: () => void;
}

export function EntryCard({ entry, onClick }: EntryCardProps) {
  const { scores, images } = entry;

  const bars = [
    { key: "scalar", value: scores.scalarFields, label: "Scalar" },
    { key: "ingredients", value: scores.ingredientParsing, label: "Ingredients" },
    { key: "instructions", value: scores.instructions, label: "Instructions" },
    ...(scores.equipmentParsing != null
      ? [{ key: "equipment", value: scores.equipmentParsing, label: "Equipment" }]
      : []),
  ];

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 overflow-hidden text-left hover:border-gray-400 hover:shadow-sm transition-all cursor-pointer group"
    >
      <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
        <img
          src={imageUrl(`data/recipe-images/${images[0]}`)}
          alt=""
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          loading="lazy"
        />
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500 truncate max-w-[60%]">
            {images[0]}
          </span>
          <ScoreBadge score={scores.overall} label="Structured" />
        </div>

        <div className="space-y-1.5">
          {bars.map((bar) => (
            <div key={bar.key} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 w-16 shrink-0">
                {bar.label}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${scoreBarColor(bar.value)}`}
                  style={{ width: `${bar.value * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-500 w-8 text-right tabular-nums">
                {Math.round(bar.value * 100)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}
