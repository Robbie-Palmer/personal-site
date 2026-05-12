import { useEffect, useMemo, useState } from "react";
import {
  loadExtractionPredictions,
  loadExtractionScores,
  loadGroundTruth,
} from "../lib/data";
import {
  computeEntryScores,
  evaluateEquipmentParsing,
  evaluateIngredientParsing,
  evaluateInstructions,
  evaluateScalarFields,
} from "../../../../src/evaluation/metrics.js";
import { extractionToRecipe } from "../../../../src/lib/extraction-to-recipe.js";
import type {
  ExtractionPredictionsDataset,
  GroundTruthDataset,
  PerImageScoreEntry,
} from "../types/extraction";
import { StageEntryCard } from "../components/StageEntryCard";

interface ExtractionListViewProps {
  onSelectEntry: (index: number) => void;
}

export function ExtractionListView({
  onSelectEntry,
}: ExtractionListViewProps) {
  const [groundTruth, setGroundTruth] = useState<GroundTruthDataset | null>(null);
  const [extractions, setExtractions] = useState<ExtractionPredictionsDataset | null>(null);
  const [scores, setScores] = useState<PerImageScoreEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGroundTruth().then(setGroundTruth).catch((e) => setError(String(e)));
    loadExtractionPredictions().then(setExtractions).catch(() => {});
    loadExtractionScores().then(setScores).catch(() => {});
  }, []);

  const scoreMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of scores) {
      map.set(s.images.join("\0"), s.scores.overall);
    }
    return map;
  }, [scores]);

  const extractionMap = useMemo(() => {
    const map = new Map<string, NonNullable<ExtractionPredictionsDataset["entries"][number]["extracted"]>>();
    for (const entry of extractions?.entries ?? []) {
      map.set(entry.images.join("\0"), entry.extracted);
    }
    return map;
  }, [extractions]);

  const entries = useMemo(() => {
    if (!groundTruth) return [];
    return groundTruth.entries.map((gt, index) => {
      const key = gt.images.join("\0");
      const predicted = extractionMap.get(key) ?? null;
      const annotated = gt.expectedExtraction != null;
      const pipelineScore = annotated ? (scoreMap.get(key) ?? null) : null;

      // Compute a client-side structured score using the same methodology as
      // the pipeline (extractionToRecipe → field-level evaluation) so scores
      // stay current when ground truth is updated via "Use as Expected".
      let score: number | null;
      if (predicted != null && gt.expectedExtraction != null) {
        const predRecipe = extractionToRecipe(predicted);
        const expRecipe = extractionToRecipe(gt.expectedExtraction);
        const scalar = evaluateScalarFields(predRecipe as never, expRecipe as never);
        const ingredients = evaluateIngredientParsing(predRecipe as never, expRecipe as never);
        const instructions = evaluateInstructions(predRecipe as never, expRecipe as never);
        const equipment = evaluateEquipmentParsing(predRecipe as never, expRecipe as never);
        score = computeEntryScores(scalar, ingredients, instructions, equipment).overall;
      } else {
        score = pipelineScore;
      }

      return {
        index,
        images: gt.images,
        title: predicted?.title ?? gt.expected.title,
        score,
        annotated,
      };
    });
  }, [extractionMap, groundTruth, scoreMap]);

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
          <h2 className="font-semibold text-lg">Extraction Review</h2>
          <p className="text-sm text-gray-500">
            OCR extraction output with ground truth comparison
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
