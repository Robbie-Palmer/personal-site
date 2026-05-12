import { useEffect, useMemo, useState } from "react";
import {
  loadCooklangPredictions,
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
} from "../../../../src/evaluation/metrics.js";
import type {
  CooklangPredictionsDataset,
  GroundTruthDataset,
  PredictionsDataset,
} from "../types/extraction";
import { StageEntryCard } from "../components/StageEntryCard";

interface NormalizationListViewProps {
  onSelectEntry: (index: number) => void;
}

export function NormalizationListView({
  onSelectEntry,
}: NormalizationListViewProps) {
  const [groundTruth, setGroundTruth] = useState<GroundTruthDataset | null>(null);
  const [predictions, setPredictions] = useState<PredictionsDataset | null>(null);
  const [cooklangPredictions, setCooklangPredictions] = useState<CooklangPredictionsDataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGroundTruth().then(setGroundTruth).catch((e) => setError(String(e)));
    loadPredictions().then(setPredictions).catch(() => {});
    loadCooklangPredictions().then(setCooklangPredictions).catch(() => {});
  }, []);

  const entries = useMemo(() => {
    if (!groundTruth) return [];
    return groundTruth.entries.map((gt, index) => {
      const key = gt.images.join("\0");
      const predicted =
        predictions?.entries.find((e) => e.images.join("\0") === key)?.predicted ?? null;
      const cooklangPred =
        cooklangPredictions?.entries.find((e) => e.images.join("\0") === key)?.cooklang ?? null;
      const annotated = gt.expectedNormalization != null;

      let score: number | null = null;
      if (annotated && cooklangPred) {
        const predDerived = deriveNormalizedRecipe(cooklangPred).recipe;
        const expDerived = deriveNormalizedRecipe(gt.expectedNormalization!).recipe;
        if (predDerived && expDerived) {
          const scalar = evaluateScalarFields(predDerived, expDerived);
          const ingredients = evaluateIngredientParsing(predDerived, expDerived);
          const instructions = evaluateInstructions(predDerived, expDerived);
          const equipment = evaluateEquipmentParsing(predDerived, expDerived);
          score = computeEntryScores(
            scalar,
            ingredients,
            instructions,
            equipment,
          ).overall;
        }
      }

      return {
        index,
        images: gt.images,
        title: predicted?.title ?? gt.expected.title,
        score,
        annotated,
      };
    });
  }, [groundTruth, predictions, cooklangPredictions]);

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
