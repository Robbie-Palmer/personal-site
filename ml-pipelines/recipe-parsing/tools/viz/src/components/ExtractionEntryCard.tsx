import type { ExtractionEntry } from "../types/extraction";
import { imageUrl } from "../lib/data";

interface ExtractionEntryCardProps {
  entry: ExtractionEntry;
  onClick: () => void;
}

export function ExtractionEntryCard({
  entry,
  onClick,
}: ExtractionEntryCardProps) {
  const annotated = entry.expectedStructuredText != null;
  const title =
    entry.predictedStructuredText?.title ??
    entry.predicted?.title ??
    entry.expected.title;

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 overflow-hidden text-left hover:border-gray-400 hover:shadow-sm transition-all cursor-pointer group"
    >
      <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
        <img
          src={imageUrl(`data/recipe-images/${entry.images[0]}`)}
          alt=""
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          loading="lazy"
        />
      </div>
      <div className="p-3">
        <div className="text-sm font-medium text-gray-900 truncate mb-1">
          {title}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 truncate max-w-[60%]">
            {entry.images.length} image{entry.images.length > 1 ? "s" : ""}
          </span>
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
        <div className="mt-2 text-xs text-gray-500">
          {entry.predictedCooklang?.derived ? "Cooklang preview ready" : "No Cooklang preview"}
        </div>
      </div>
    </button>
  );
}
