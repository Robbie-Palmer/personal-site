import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import type { ReviewManifest, ReviewEntry } from "../types/review";
import { loadEntry } from "../lib/data";
import { ImagePanel } from "../components/ImagePanel";
import { SideBySideRecipe } from "../components/SideBySideRecipe";
import { ScoresPanel } from "../components/ScoresPanel";
import { CanonicalizationPanel } from "../components/CanonicalizationPanel";

interface EntryDetailViewProps {
  entryId: string;
  manifest: ReviewManifest;
  onBack: () => void;
}

export function EntryDetailView({
  entryId,
  manifest,
  onBack,
}: EntryDetailViewProps) {
  const [entry, setEntry] = useState<ReviewEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const manifestEntry = manifest.entries.find((e) => e.entryId === entryId);

  useEffect(() => {
    let cancelled = false;
    setEntry(null);
    setError(null);
    loadEntry(entryId)
      .then((e) => { if (!cancelled) setEntry(e); })
      .catch((e) => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, [entryId]);

  // Keyboard navigation: Escape to go back, arrow keys for prev/next
  useEffect(() => {
    const sortedEntries = [...manifest.entries].sort(
      (a, b) => a.scores.overall - b.scores.overall,
    );
    const currentIdx = sortedEntries.findIndex((e) => e.entryId === entryId);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onBack();
      } else if (e.key === "ArrowLeft" && currentIdx > 0) {
        window.location.hash = `entry/${sortedEntries[currentIdx - 1].entryId}`;
      } else if (
        e.key === "ArrowRight" &&
        currentIdx < sortedEntries.length - 1
      ) {
        window.location.hash = `entry/${sortedEntries[currentIdx + 1].entryId}`;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [entryId, manifest, onBack]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex-1">
          <h2 className="font-semibold">
            {entry?.expectedRecipe.title ?? manifestEntry?.images[0] ?? entryId}
          </h2>
          <p className="text-xs text-gray-400">
            {entryId}
            <span className="ml-2 text-gray-300">
              Use \u2190 \u2192 arrows to navigate, Esc to go back
            </span>
          </p>
        </div>
      </div>

      {!entry ? (
        <div className="text-gray-400 py-12 text-center">Loading entry...</div>
      ) : (
        <>
          <ImagePanel imagePaths={entry.imagePaths} />
          <ScoresPanel scores={entry.scores} />
          <SideBySideRecipe entry={entry} />
          <CanonicalizationPanel images={entry.images} />
        </>
      )}
    </div>
  );
}
