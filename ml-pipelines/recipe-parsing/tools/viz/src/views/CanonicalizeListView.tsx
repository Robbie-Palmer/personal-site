import { useEffect, useMemo, useState } from "react";
import {
  loadCanonicalizedPredictions,
  loadFinalScores,
  loadGroundTruth,
} from "../lib/data";
import { aggregateMetrics } from "../../../../src/evaluation/metrics.js";
import type {
  GroundTruthDataset,
  PerImageScoreEntry,
  PredictionsDataset,
} from "../types/extraction";
import { StageEntryCard } from "../components/StageEntryCard";

interface CanonicalizeListViewProps {
  onSelectEntry: (index: number) => void;
}

export function CanonicalizeListView({
  onSelectEntry,
}: CanonicalizeListViewProps) {
  const [groundTruth, setGroundTruth] = useState<GroundTruthDataset | null>(null);
  const [predictions, setPredictions] = useState<PredictionsDataset | null>(null);
  const [pipelineScores, setPipelineScores] = useState<PerImageScoreEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGroundTruth().then(setGroundTruth).catch((e) => setError(String(e)));
    loadCanonicalizedPredictions().then(setPredictions).catch(() => {});
    loadFinalScores().then(setPipelineScores).catch(() => {});
  }, []);

  const scores = useMemo(() => {
    if (!groundTruth || !predictions) return pipelineScores;
    try {
      return aggregateMetrics(
        predictions.entries as never,
        groundTruth.entries as never,
      ).perEntry as PerImageScoreEntry[];
    } catch {
      return pipelineScores;
    }
  }, [groundTruth, pipelineScores, predictions]);

  const scoreMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of scores) {
      map.set(s.images.join("\0"), s.scores.overall);
    }
    return map;
  }, [scores]);

  const entries = useMemo(() => {
    if (!groundTruth) return [];
    return groundTruth.entries.map((gt, index) => {
      const key = gt.images.join("\0");
      const predicted =
        predictions?.entries.find((e) => e.images.join("\0") === key)?.predicted ?? null;
      return {
        index,
        images: gt.images,
        title: predicted?.title ?? gt.expected.title,
        score: scoreMap.get(key) ?? null,
        annotated: gt.expected != null,
      };
    });
  }, [groundTruth, predictions, scoreMap]);

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
          <h2 className="font-semibold text-lg">Canonicalize Review</h2>
          <p className="text-sm text-gray-500">
            Final canonicalized predictions vs ground truth
          </p>
        </div>
        <span className="text-sm text-gray-500">
          {entries.length} entries
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {entries.map((entry) => (
          <StageEntryCard
            key={entry.index}
            images={entry.images}
            title={entry.title}
            score={entry.score}
            annotated={entry.annotated}
            onClick={() => onSelectEntry(entry.index)}
          />
        ))}
      </div>
    </div>
  );
}
