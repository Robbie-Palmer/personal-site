import { imageUrl } from "../lib/data";
import { ScoreBadge } from "./ScoreBadge";

interface StageEntryCardProps {
  images: string[];
  title: string;
  score: number | null;
  annotated: boolean;
  onClick: () => void;
}

export function StageEntryCard({
  images,
  title,
  score,
  annotated,
  onClick,
}: StageEntryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 overflow-hidden text-left hover:border-gray-400 hover:shadow-sm transition-all cursor-pointer group"
    >
      <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
        {images.length > 0 ? (
          <img
            src={imageUrl(`data/recipe-images/${images[0]}`)}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
            No image
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="text-sm font-medium text-gray-900 truncate mb-1">
          {title}
        </div>
        <div className="flex items-center justify-between">
          {score != null ? (
            <ScoreBadge score={score} />
          ) : (
            <span className="text-xs text-gray-400">No score</span>
          )}
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              annotated
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {annotated ? "Annotated" : "Unannotated"}
          </span>
        </div>
      </div>
    </button>
  );
}
