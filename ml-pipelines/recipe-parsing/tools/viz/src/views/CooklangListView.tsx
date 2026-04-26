import { useEffect, useMemo, useState } from "react";
import {
  loadCooklangPredictions,
  loadGroundTruth,
  loadPredictions,
} from "../lib/data";
import type {
  CooklangEntry,
  CooklangPredictionsDataset,
  GroundTruthDataset,
  PredictionsDataset,
} from "../types/extraction";
import { ExtractionEntryCard } from "../components/ExtractionEntryCard";

interface CooklangListViewProps {
  onSelectEntry: (index: number) => void;
}

export function CooklangListView({ onSelectEntry }: CooklangListViewProps) {
  const [groundTruth, setGroundTruth] = useState<GroundTruthDataset | null>(null);
  const [predictions, setPredictions] = useState<PredictionsDataset | null>(null);
  const [cooklang, setCooklang] = useState<CooklangPredictionsDataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGroundTruth().then(setGroundTruth).catch((e) => setError(String(e)));
    loadPredictions().then(setPredictions).catch(() => {});
    loadCooklangPredictions().then(setCooklang).catch(() => {});
  }, []);

  const entries: CooklangEntry[] = useMemo(() => {
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
        predictedCooklang:
          cooklang?.entries.find((entry) => entry.images.join("\0") === key)?.cooklang ??
          null,
        expectedCooklang: gt.expectedCooklang ?? null,
      };
    });
  }, [cooklang, groundTruth, predictions]);

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
          <h2 className="font-semibold text-lg">Cooklang Review</h2>
          <p className="text-sm text-gray-500">
            Structured text to Cooklang plus derived normalized preview
          </p>
        </div>
        <span className="text-sm text-gray-500">
          {entries.filter((entry) => entry.expectedCooklang != null).length}/{entries.length} annotated
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {entries.map((entry) => (
          <ExtractionEntryCard
            key={entry.index}
            entry={{
              index: entry.index,
              images: entry.images,
              expected: entry.expected,
              predicted: entry.predicted,
              predictedStructuredText: null,
              expectedStructuredText: null,
              predictedCooklang: entry.predictedCooklang,
            }}
            onClick={() => onSelectEntry(entry.index)}
          />
        ))}
      </div>
    </div>
  );
}
