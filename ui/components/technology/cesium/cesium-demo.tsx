"use client";

import { Globe2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CESIUM_REFERENCE_POINTS } from "./cesium-demo-data";
import { LazyCesiumDemoCanvas } from "./lazy-cesium-demo-canvas";

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function CesiumDemo() {
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [startupFailure, setStartupFailure] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const reportStartupFailure = useCallback((error: unknown) => {
    setStartupFailure(
      error instanceof Error && error.message
        ? error.message
        : "Cesium reported an unknown startup error",
    );
  }, []);

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <link rel="stylesheet" href="/cesium/Widgets/widgets.css" />
      <div className="space-y-1 border-b p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Offline WGS84 globe</h3>
          <span className="rounded-full border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            Local imagery · no token
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Select a reference point to move the camera. The globe uses CesiumJS's
          bundled Natural Earth II tiles and ellipsoid terrain, so every request
          stays on this site.
        </p>
      </div>

      <div className="h-[26rem] bg-zinc-950 sm:h-[34rem]">
        {startupFailure ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center text-sm text-zinc-300">
            <p>
              The 3D globe could not start in this browser. The coordinate table
              below contains the same reference points.
            </p>
            <p className="max-w-xl font-mono text-xs text-zinc-400">
              Diagnostic: {startupFailure}
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setStartupFailure(null)}
            >
              Retry globe
            </Button>
          </div>
        ) : (
          <LazyCesiumDemoCanvas
            onFailure={reportStartupFailure}
            reducedMotion={reducedMotion}
            selectedPointId={selectedPointId}
          />
        )}
      </div>

      <div className="space-y-4 border-t p-4">
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Globe camera targets</legend>
          <Button
            type="button"
            size="sm"
            variant={selectedPointId === null ? "default" : "outline"}
            aria-pressed={selectedPointId === null}
            onClick={() => setSelectedPointId(null)}
          >
            <Globe2 className="mr-2 h-4 w-4" />
            Global
          </Button>
          {CESIUM_REFERENCE_POINTS.map((point) => (
            <Button
              key={point.id}
              type="button"
              size="sm"
              variant={selectedPointId === point.id ? "default" : "outline"}
              aria-pressed={selectedPointId === point.id}
              onClick={() => setSelectedPointId(point.id)}
            >
              {point.label}
            </Button>
          ))}
        </fieldset>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Reference point</th>
                <th className="pb-2 text-right font-medium">Latitude</th>
                <th className="pb-2 text-right font-medium">Longitude</th>
              </tr>
            </thead>
            <tbody>
              {CESIUM_REFERENCE_POINTS.map((point) => (
                <tr
                  key={point.id}
                  className={
                    selectedPointId === point.id
                      ? "border-t bg-muted/50"
                      : "border-t"
                  }
                >
                  <td className="py-2 font-medium">{point.label}</td>
                  <td className="py-2 text-right font-mono text-xs tabular-nums">
                    {point.latitudeDegrees.toFixed(4)}°
                  </td>
                  <td className="py-2 text-right font-mono text-xs tabular-nums">
                    {point.longitudeDegrees.toFixed(4)}°
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {reducedMotion && (
          <p className="text-xs text-muted-foreground">
            Camera transitions snap to their destination because this device
            requests reduced motion.
          </p>
        )}
      </div>
    </Card>
  );
}
