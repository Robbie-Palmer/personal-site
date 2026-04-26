import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Save, AlertCircle } from "lucide-react";
import {
  imageUrl,
  loadCooklangPredictions,
  loadGroundTruth,
  loadPredictions,
  loadStructuredTextPredictions,
  saveGroundTruth,
} from "../lib/data";
import type {
  CooklangPredictionsDataset,
  GroundTruthDataset,
  PredictionsDataset,
  StructuredTextPredictionsDataset,
  StructuredTextRecipe,
} from "../types/extraction";
import { ImagePanel } from "../components/ImagePanel";
import { ImageViewer } from "../components/ImageViewer";
import { RecipePanel } from "../components/RecipePanel";
import { StructuredTextEditor } from "../components/StructuredTextEditor";

interface ExtractionDetailViewProps {
  entryIndex: number;
  onBack: () => void;
  onNavigate: (index: number) => void;
}

const EMPTY_STRUCTURED_TEXT: StructuredTextRecipe = {
  ingredientSections: [{ lines: ["ingredient"] }],
  instructionLines: ["instruction"],
  notes: [],
  equipment: [],
  timers: [],
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ExtractionDetailView({
  entryIndex,
  onBack,
  onNavigate,
}: ExtractionDetailViewProps) {
  const [groundTruth, setGroundTruth] = useState<GroundTruthDataset | null>(null);
  const [predictions, setPredictions] = useState<PredictionsDataset | null>(null);
  const [structured, setStructured] = useState<StructuredTextPredictionsDataset | null>(
    null,
  );
  const [cooklang, setCooklang] = useState<CooklangPredictionsDataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [edited, setEdited] = useState<StructuredTextRecipe | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    loadGroundTruth().then(setGroundTruth).catch((e) => setError(String(e)));
    loadPredictions().then(setPredictions).catch(() => {});
    loadStructuredTextPredictions().then(setStructured).catch(() => {});
    loadCooklangPredictions().then(setCooklang).catch(() => {});
  }, []);

  const gtEntry = groundTruth?.entries[entryIndex];
  const predictionKey = gtEntry?.images.join("\0");
  const predictedRecipe =
    predictionKey == null
      ? null
      : predictions?.entries.find((entry) => entry.images.join("\0") === predictionKey)
          ?.predicted ?? null;
  const predictedStructured =
    predictionKey == null
      ? null
      : structured?.entries.find((entry) => entry.images.join("\0") === predictionKey)
          ?.extracted ?? null;
  const predictedCooklang =
    predictionKey == null
      ? null
      : cooklang?.entries.find((entry) => entry.images.join("\0") === predictionKey)
          ?.cooklang ?? null;

  useEffect(() => {
    if (gtEntry) {
      setEdited(gtEntry.expectedStructuredText ?? null);
      setDirty(false);
      setSaveStatus("idle");
    }
  }, [entryIndex, gtEntry]);

  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!groundTruth) return;
    setSaveError(null);
    if (edited) {
      const emptyIngredients = edited.ingredientSections.some((s) =>
        s.lines.some((l) => l.trim().length === 0),
      );
      const emptyInstructions = edited.instructionLines.some(
        (l) => l.trim().length === 0,
      );
      if (emptyIngredients || emptyInstructions) {
        setSaveError(
          "Cannot save: ingredient lines and instruction lines must be non-empty.",
        );
        setSaveStatus("error");
        return;
      }
    }
    setSaveStatus("saving");
    try {
      const updated = structuredClone(groundTruth);
      if (edited) {
        updated.entries[entryIndex].expectedStructuredText = edited;
      } else {
        delete updated.entries[entryIndex].expectedStructuredText;
      }
      await saveGroundTruth(updated);
      setGroundTruth(updated);
      setDirty(false);
      setSaveStatus("saved");
    } catch (e) {
      console.error("Save failed:", e);
      setSaveStatus("error");
    }
  }, [edited, entryIndex, groundTruth]);

  useEffect(() => {
    const totalEntries = groundTruth?.entries.length ?? 0;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (dirty) handleSave();
        return;
      }
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === "Escape") {
        onBack();
      } else if (e.key === "ArrowLeft" && entryIndex > 0) {
        onNavigate(entryIndex - 1);
      } else if (e.key === "ArrowRight" && entryIndex < totalEntries - 1) {
        onNavigate(entryIndex + 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dirty, entryIndex, groundTruth, handleSave, onBack, onNavigate]);

  const previewRecipe = useMemo(
    () => predictedCooklang?.derived ?? predictedRecipe ?? gtEntry?.expected ?? null,
    [gtEntry?.expected, predictedCooklang?.derived, predictedRecipe],
  );

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!groundTruth || !gtEntry) {
    return <div className="text-gray-400 py-12 text-center">Loading...</div>;
  }

  const title =
    predictedStructured?.title ?? predictedRecipe?.title ?? gtEntry.expected.title;
  const totalEntries = groundTruth.entries.length;

  return (
    <div className="space-y-4">
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
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-gray-400">
            Entry {entryIndex + 1} of {totalEntries}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {predictedStructured && (
            <button
              type="button"
              onClick={() => {
                setEdited(structuredClone(predictedStructured));
                setDirty(true);
                setSaveStatus("idle");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded hover:bg-gray-50"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy Prediction
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEdited(structuredClone(EMPTY_STRUCTURED_TEXT));
              setDirty(true);
              setSaveStatus("idle");
            }}
            className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded hover:bg-gray-50"
          >
            Init Empty
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saveStatus === "saving"}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded font-medium ${
              dirty
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {saveStatus === "saving" ? (
              "Saving..."
            ) : saveStatus === "saved" ? (
              <>
                <Check className="h-3.5 w-3.5" /> Saved
              </>
            ) : saveStatus === "error" ? (
              <>
                <AlertCircle className="h-3.5 w-3.5" /> Error
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" /> Save
              </>
            )}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700">
          {saveError}
        </div>
      )}

      {viewerIndex != null && (
        <ImageViewer
          sources={gtEntry.images.map((img) => imageUrl(`data/recipe-images/${img}`))}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}

      <div className="grid grid-cols-[1fr_1.25fr_1.1fr] gap-4 items-start">
        <div className="sticky top-4 self-start space-y-4">
          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              Input Images
            </div>
            <ImagePanel
              imagePaths={gtEntry.images.map((img) => `data/recipe-images/${img}`)}
              onClickImage={setViewerIndex}
            />
          </div>
          {predictedStructured && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Model Extraction Snapshot
              </div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                {JSON.stringify(predictedStructured, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div>
          {edited ? (
            <StructuredTextEditor
              value={edited}
              onChange={(next) => {
                setEdited(next);
                setDirty(true);
                setSaveStatus("idle");
              }}
            />
          ) : (
            <div className="bg-white rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
              No structured extraction annotation yet.
            </div>
          )}
        </div>

        <div className="space-y-4">
          {previewRecipe ? (
            <RecipePanel recipe={previewRecipe} label="Derived Preview" />
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-5 text-sm text-gray-500">
              No derived preview available yet.
            </div>
          )}
          {predictedCooklang && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Linked Cooklang Body
              </div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                {predictedCooklang.body}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
