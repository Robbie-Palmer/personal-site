import { useEffect, useMemo, useState } from "react";
import {
  loadCooklangPredictions,
  loadGroundTruth,
  loadPredictions,
  loadStructuredTextPredictions,
} from "../lib/data";
import type {
  CooklangPredictionsDataset,
  ExtractionEntry,
  GroundTruthDataset,
  PredictionsDataset,
  StructuredTextPredictionsDataset,
} from "../types/extraction";
import { ExtractionEntryCard } from "../components/ExtractionEntryCard";

interface ExtractionListViewProps {
  onSelectEntry: (index: number) => void;
}

export function ExtractionListView({
  onSelectEntry,
}: ExtractionListViewProps) {
  const [groundTruth, setGroundTruth] = useState<GroundTruthDataset | null>(null);
  const [predictions, setPredictions] = useState<PredictionsDataset | null>(null);
  const [structured, setStructured] = useState<StructuredTextPredictionsDataset | null>(
    null,
  );
  const [cooklang, setCooklang] = useState<CooklangPredictionsDataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGroundTruth().then(setGroundTruth).catch((e) => setError(String(e)));
    loadPredictions().then(setPredictions).catch(() => {});
    loadStructuredTextPredictions().then(setStructured).catch(() => {});
    loadCooklangPredictions().then(setCooklang).catch(() => {});
  }, []);

  const entries: ExtractionEntry[] = useMemo(() => {
    if (!groundTruth) return [];
    return groundTruth.entries.map((gt, index) => {
      const key = gt.images.join("\0");
      return {
        index,
        images: gt.images,
        expected: gt.expected,
        predicted:
          predictions?.entries.find((entry) => entry.images.join("\0") === key)?.predicted ??
          null,
        predictedStructuredText:
          structured?.entries.find((entry) => entry.images.join("\0") === key)?.extracted ??
          null,
        expectedStructuredText: gt.expectedStructuredText ?? null,
        predictedCooklang:
          cooklang?.entries.find((entry) => entry.images.join("\0") === key)?.cooklang ??
          null,
      };
    });
  }, [cooklang, groundTruth, predictions, structured]);

  const annotatedCount = entries.filter(
    (entry) => entry.expectedStructuredText != null,
  ).length;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!groundTruth) {
    return <div className="text-gray-400 py-12 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">Structured Extraction Review</h2>
          <p className="text-sm text-gray-500">
            Image to structured text artifact with derived preview support
          </p>
        </div>
        <span className="text-sm text-gray-500">
          {annotatedCount}/{entries.length} annotated
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {entries.map((entry) => (
          <ExtractionEntryCard
            key={entry.index}
            entry={entry}
            onClick={() => onSelectEntry(entry.index)}
          />
        ))}
      </div>
    </div>
  );
}
