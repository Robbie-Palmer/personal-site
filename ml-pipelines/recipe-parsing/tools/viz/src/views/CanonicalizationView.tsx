import { useState, useEffect, useMemo } from "react";
import type { ReviewManifest } from "../types/review";
import type { CanonicalizationFile } from "../types/canonicalization";
import { loadCanonicalization } from "../lib/data";
import { CanonicalizationTable } from "../components/CanonicalizationTable";

interface CanonicalizationViewProps {
  manifest: ReviewManifest;
  onSelectEntry: (entryId: string) => void;
}

export function CanonicalizationView({
  manifest,
  onSelectEntry,
}: CanonicalizationViewProps) {
  const [data, setData] = useState<CanonicalizationFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCanonicalization()
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  // Build a map from image filename to entryId
  const imageToEntryId = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of manifest.entries) {
      for (const img of entry.images) {
        map.set(img, entry.entryId);
      }
    }
    return map;
  }, [manifest]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!data) {
    return <div className="text-gray-400 py-12 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Canonicalization Inspector</h2>
      <CanonicalizationTable
        data={data}
        onSelectEntry={onSelectEntry}
        imageToEntryId={imageToEntryId}
      />
    </div>
  );
}
