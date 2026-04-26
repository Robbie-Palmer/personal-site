import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Check, Copy, Save } from "lucide-react";
import {
  imageUrl,
  loadCooklangPredictions,
  loadGroundTruth,
  saveGroundTruth,
} from "../lib/data";
import { deriveNormalizedRecipe } from "../lib/cooklang";
import type {
  CooklangPredictionsDataset,
  CooklangRecipe,
  GroundTruthDataset,
} from "../types/extraction";
import { CooklangEditor } from "../components/CooklangEditor";
import { ImagePanel } from "../components/ImagePanel";
import { ImageViewer } from "../components/ImageViewer";
import { RecipePanel } from "../components/RecipePanel";

interface CooklangDetailViewProps {
  entryIndex: number;
  onBack: () => void;
  onNavigate: (index: number) => void;
}

const EMPTY_COOKLANG: CooklangRecipe = {
  frontmatter: { tags: [] },
  body: "",
  diagnostics: [],
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function CooklangDetailView({
  entryIndex,
  onBack,
  onNavigate,
}: CooklangDetailViewProps) {
  const [groundTruth, setGroundTruth] = useState<GroundTruthDataset | null>(null);
  const [predictions, setPredictions] = useState<CooklangPredictionsDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edited, setEdited] = useState<CooklangRecipe | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const resetEntryKeyRef = useRef<string | null>(null);

  useEffect(() => {
    loadGroundTruth().then(setGroundTruth).catch((e) => setError(String(e)));
    loadCooklangPredictions().then(setPredictions).catch(() => {});
  }, []);

  const gtEntry = groundTruth?.entries[entryIndex];
  const predictionKey = gtEntry?.images.join("\0");
  const predictedCooklang =
    predictionKey == null
      ? null
      : predictions?.entries.find((entry) => entry.images.join("\0") === predictionKey)
          ?.cooklang ?? null;

  useEffect(() => {
    if (!gtEntry || !predictionKey || resetEntryKeyRef.current === predictionKey) {
      return;
    }
    resetEntryKeyRef.current = predictionKey;
    setEdited(gtEntry.expectedCooklang ?? null);
    setDirty(false);
    setSaveStatus("idle");
    setSaveMessage(null);
  }, [gtEntry, predictionKey]);

  const handleSave = useCallback(async () => {
    if (!groundTruth) return;
    setSaveStatus("saving");
    setSaveMessage(null);
    try {
      const updated = structuredClone(groundTruth);
      if (edited) {
        const { derived: _derived, ...cleanEdited } = edited;
        updated.entries[entryIndex].expectedCooklang = {
          ...cleanEdited,
          diagnostics: [],
        };
      } else {
        delete updated.entries[entryIndex].expectedCooklang;
      }
      const result = await saveGroundTruth(updated);
      setGroundTruth(updated);
      setDirty(false);
      setSaveStatus("saved");
      setSaveMessage(result.message ?? null);
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

  const livePreview = useMemo(() => {
    if (!edited) return null;
    // Recompute preview from the current editor value rather than trusting
    // stale embedded `derived`/`diagnostics` copied from a prior artifact.
    return deriveNormalizedRecipe({
      ...edited,
      derived: undefined,
      diagnostics: [],
    });
  }, [edited]);

  const preview = useMemo(() => {
    if (!edited) return predictedCooklang?.derived ?? gtEntry?.expected ?? null;
    return livePreview?.recipe ?? null;
  }, [edited, gtEntry?.expected, livePreview?.recipe, predictedCooklang?.derived]);

  const previewDiagnostics = useMemo(() => {
    if (!edited) return predictedCooklang?.diagnostics ?? [];
    return livePreview?.diagnostics ?? [];
  }, [edited, livePreview?.diagnostics, predictedCooklang?.diagnostics]);

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
          <h2 className="font-semibold">{gtEntry.expected.title}</h2>
          <p className="text-xs text-gray-400">
            Entry {entryIndex + 1} of {groundTruth.entries.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {predictedCooklang && (
            <button
              type="button"
              onClick={() => {
                setEdited(structuredClone(predictedCooklang));
                setDirty(true);
                setSaveStatus("idle");
                setSaveMessage(null);
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
              setEdited(structuredClone(EMPTY_COOKLANG));
              setDirty(true);
              setSaveStatus("idle");
              setSaveMessage(null);
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

      {saveMessage && (
        <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm text-amber-800">
          {saveMessage}
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
        <div className="sticky top-4 self-start">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Input Images
          </div>
          <ImagePanel
            imagePaths={gtEntry.images.map((img) => `data/recipe-images/${img}`)}
            onClickImage={setViewerIndex}
          />
        </div>
        <div>
          {edited ? (
            <CooklangEditor
              value={edited}
              diagnostics={previewDiagnostics}
              onChange={(next) => {
                setEdited(next);
                setDirty(true);
                setSaveStatus("idle");
                setSaveMessage(null);
              }}
            />
          ) : (
            <div className="bg-white rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
              No Cooklang annotation yet.
            </div>
          )}
        </div>
        <div className="space-y-4">
          {preview ? (
            <RecipePanel recipe={preview} label="Derived Normalized Preview" />
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-5 text-sm text-gray-500">
              Preview unavailable.
            </div>
          )}
          {previewDiagnostics.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-amber-700 mb-2">
                Preview Diagnostics
              </div>
              <ul className="space-y-1 text-sm text-amber-900">
                {previewDiagnostics.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
