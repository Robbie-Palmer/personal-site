import { useEffect, useMemo, useState } from "react";
import {
  loadGroundTruth,
  loadPredictions,
} from "../lib/data";
import { deriveNormalizedRecipe } from "../lib/cooklang";
import {
  computeEntryScores,
  evaluateEquipmentParsing,
  evaluateIngredientParsing,
  evaluateInstructions,
  evaluateScalarFields,
  NORMALIZATION_SCORING_PROFILE,
} from "../../../../src/evaluation/metrics.js";
import type {
  GroundTruthDataset,
  PredictionsDataset,
} from "../types/extraction";
import { StageEntryCard } from "../components/StageEntryCard";

interface NormalizationListViewProps {
  onSelectEntry: (index: number) => void;
}

export function NormalizationListView({
  onSelectEntry,
}: Readonly<NormalizationListViewProps>) {
  const [groundTruth, setGroundTruth] = useState<GroundTruthDataset | null>(null);
  const [predictions, setPredictions] = useState<PredictionsDataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGroundTruth().then(setGroundTruth).catch((e) => setError(String(e)));
    loadPredictions().then(setPredictions).catch(() => {});
  }, []);

  const entries = useMemo(() => {
    if (!groundTruth) return [];
    return groundTruth.entries.map((gt, index) => {
      const key = gt.images.join("\0");
      const predicted =
        predictions?.entries.find((e) => e.images.join("\0") === key)?.predicted ?? null;
      const expDerived = gt.expectedNormalization
        ? deriveNormalizedRecipe(gt.expectedNormalization).recipe
        : null;
      const annotated = expDerived != null;

      let score: number | null = null;
      if (annotated && predicted) {
        const scalar = evaluateScalarFields(predicted, expDerived);
        const ingredients = evaluateIngredientParsing(predicted, expDerived);
        const instructions = evaluateInstructions(predicted, expDerived);
        const equipment = evaluateEquipmentParsing(predicted, expDerived);
        score = computeEntryScores(
          scalar,
          ingredients,
          instructions,
          equipment,
          NORMALIZATION_SCORING_PROFILE,
        ).overall;
      }

      return {
        index,
        images: gt.images,
        title: predicted?.title ?? gt.expected.title,
        score,
        annotated,
      };
    });
  }, [groundTruth, predictions]);

  const annotatedCount = entries.filter((e) => e.annotated).length;

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
          <h2 className="font-semibold text-lg">Normalization Review</h2>
          <p className="text-sm text-gray-500">
            Structured text to normalized recipe comparison
          </p>
        </div>
        <span className="text-sm text-gray-500">
          {annotatedCount}/{entries.length} annotated
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
