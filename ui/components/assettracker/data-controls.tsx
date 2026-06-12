"use client";

import { DownloadIcon, RotateCcwIcon, UploadIcon } from "lucide-react";
import { type ChangeEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatAssetTrackerError } from "@/lib/domain/assettracker";
import { useAssetTracker } from "./asset-tracker-provider";

export function DataControls() {
  const { hasLocalChanges, exportData, importData, resetData } =
    useAssetTracker();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      await importData(file);
      setError(null);
    } catch (err) {
      setError(formatAssetTrackerError(err));
    }
  }

  async function handleReset() {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    await resetData();
    setConfirmingReset(false);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {hasLocalChanges
            ? "Your changes are saved in this browser — nothing leaves your device."
            : "This is demo data. Log a balance or add an account to try it; changes are saved in your browser."}
        </p>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="sm" onClick={exportData}>
            <DownloadIcon />
            Export
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon />
            Import
          </Button>
          {hasLocalChanges && (
            <Button
              variant={confirmingReset ? "destructive" : "ghost"}
              size="sm"
              onClick={handleReset}
            >
              <RotateCcwIcon />
              {confirmingReset ? "Discard my data?" : "Reset demo"}
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Import Asset Tracker JSON export"
            onChange={handleImport}
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
