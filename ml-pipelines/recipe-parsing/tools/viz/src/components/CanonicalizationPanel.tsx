import { useState, useEffect } from "react";
import type {
  CanonicalizationEntry,
  CanonicalizationDecision,
} from "../types/canonicalization";
import { loadCanonicalization } from "../lib/data";
import { MethodBadge } from "./MethodBadge";
import { humanizeSlug } from "../lib/format";

interface CanonicalizationPanelProps {
  images: string[];
}

function DecisionRow({ decision }: { decision: CanonicalizationDecision }) {
  const [expanded, setExpanded] = useState(false);
  const changed = decision.originalSlug !== decision.canonicalSlug;

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
      >
        <span className="font-mono text-xs flex-1">
          {humanizeSlug(decision.originalSlug)}
          {changed && (
            <>
              <span className="text-gray-400 mx-1">{"\u2192"}</span>
              <span className="font-semibold">
                {humanizeSlug(decision.canonicalSlug)}
              </span>
            </>
          )}
        </span>
        <MethodBadge method={decision.method} />
        <span className="text-xs text-gray-400 tabular-nums w-10 text-right">
          {decision.score?.toFixed(2) ?? "—"}
        </span>
        <span className="text-gray-300 text-xs">{expanded ? "\u25B2" : "\u25BC"}</span>
      </button>
      {expanded && decision.candidates.length > 0 && (
        <div className="px-3 pb-2 pl-6">
          <div className="text-xs text-gray-400 mb-1">Candidates:</div>
          {decision.candidates.map((c) => (
            <div
              key={c.slug}
              className="text-xs flex items-center gap-2 py-0.5"
            >
              <span className="font-mono">{c.slug}</span>
              <span className="text-gray-400">
                {c.score.toFixed(2)}
              </span>
            </div>
          ))}
          {decision.reason && (
            <div className="text-xs text-red-600 mt-1">
              Reason: {decision.reason}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CanonicalizationPanel({ images }: CanonicalizationPanelProps) {
  const [entry, setEntry] = useState<CanonicalizationEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCanonicalization()
      .then((data) => {
        const match = data.entries.find(
          (e) => e.images[0] === images[0],
        );
        setEntry(match ?? null);
      })
      .catch(() => setEntry(null))
      .finally(() => setLoading(false));
  }, [images]);

  if (loading) {
    return <p className="text-sm text-gray-400">Loading canonicalization...</p>;
  }

  if (!entry) {
    return (
      <p className="text-sm text-gray-400">
        No canonicalization data for this entry.
      </p>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <h3 className="font-semibold text-sm px-4 py-3 border-b border-gray-200">
        Canonicalization Decisions ({entry.decisions.length})
      </h3>
      <div>
        {entry.decisions.map((d) => (
          <DecisionRow key={d.originalSlug} decision={d} />
        ))}
      </div>
    </div>
  );
}
