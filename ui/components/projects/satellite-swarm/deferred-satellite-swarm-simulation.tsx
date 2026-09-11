"use client";

import { LoaderCircle, RotateCcw } from "lucide-react";
import {
  type SubmitEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { SatelliteSwarmSimulation as SimulationData } from "@/lib/api/satellite-swarm-simulation";
import {
  runSatelliteSwarmSimulation,
  type SatelliteSwarmObjective,
} from "@/lib/browser/satellite-swarm-worker-client";
import { SatelliteSwarmSimulation } from "./satellite-swarm-simulation";

const SOUTH_POLE_OBJECTIVE: SatelliteSwarmObjective = {
  latitudeDegrees: -90,
  longitudeDegrees: 0,
};

function messageFrom(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "The WebAssembly simulation failed.";
}

function Placeholder({
  error,
  onRetry,
}: Readonly<{ error: string | null; onRetry: () => void }>) {
  return (
    <Card
      className="not-prose my-8 gap-0 overflow-hidden p-0"
      aria-live="polite"
    >
      <div className="space-y-1 border-b p-4">
        <h3 className="text-lg font-semibold">C++ mission simulation</h3>
        <p className="text-sm text-muted-foreground">
          {error
            ? "The simulation worker could not start."
            : "Loading the C++ WebAssembly module..."}
        </p>
      </div>
      <div className="flex h-72 flex-col items-center justify-center gap-4 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        {error ? (
          <>
            <p className="max-w-xl font-mono text-xs">{error}</p>
            <Button type="button" variant="outline" onClick={onRetry}>
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              Retry simulation
            </Button>
          </>
        ) : (
          <>
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span>
              The worker loads when this section approaches the viewport.
            </span>
          </>
        )}
      </div>
    </Card>
  );
}

interface MissionControlsProps {
  error: string | null;
  latitude: string;
  longitude: string;
  onLatitudeChange: (value: string) => void;
  onLongitudeChange: (value: string) => void;
  onReset: () => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  running: boolean;
}

function MissionControls({
  error,
  latitude,
  longitude,
  onLatitudeChange,
  onLongitudeChange,
  onReset,
  onSubmit,
  running,
}: Readonly<MissionControlsProps>) {
  return (
    <form
      className="mt-4 grid gap-3 rounded-lg border bg-background/60 p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
      onSubmit={onSubmit}
    >
      <label
        className="space-y-1 text-xs font-medium"
        htmlFor="satellite-swarm-longitude"
      >
        <span>Longitude</span>
        <Input
          id="satellite-swarm-longitude"
          type="number"
          min={-180}
          max={180}
          step="any"
          required
          value={longitude}
          onChange={(event) => onLongitudeChange(event.target.value)}
          aria-describedby={error ? "satellite-swarm-run-error" : undefined}
        />
      </label>
      <label
        className="space-y-1 text-xs font-medium"
        htmlFor="satellite-swarm-latitude"
      >
        <span>Latitude</span>
        <Input
          id="satellite-swarm-latitude"
          type="number"
          min={-90}
          max={90}
          step="any"
          required
          value={latitude}
          onChange={(event) => onLatitudeChange(event.target.value)}
          aria-describedby={error ? "satellite-swarm-run-error" : undefined}
        />
      </label>
      <Button type="button" variant="outline" onClick={onReset}>
        South Pole
      </Button>
      <Button type="submit" disabled={running}>
        {running && (
          <LoaderCircle
            className="mr-2 h-4 w-4 animate-spin"
            aria-hidden="true"
          />
        )}
        {running ? "Running mission" : "Run mission"}
      </Button>
      <p className="text-xs text-muted-foreground sm:col-span-4">
        Run mission recalculates the C++ trace. The controls below play, pause,
        or inspect that result.
      </p>
      {error && (
        <p
          id="satellite-swarm-run-error"
          className="text-xs text-destructive sm:col-span-4"
          role="alert"
        >
          {error}
        </p>
      )}
    </form>
  );
}

export function DeferredSatelliteSwarmSimulation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRequestRef = useRef<AbortController | null>(null);
  const [simulation, setSimulation] = useState<{
    data: SimulationData;
    runId: number;
    startPlaying: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latitude, setLatitude] = useState(
    String(SOUTH_POLE_OBJECTIVE.latitudeDegrees),
  );
  const [longitude, setLongitude] = useState(
    String(SOUTH_POLE_OBJECTIVE.longitudeDegrees),
  );
  const [running, setRunning] = useState(false);
  const [visible, setVisible] = useState(false);

  const run = useCallback(
    async (objective: SatelliteSwarmObjective, startPlaying = false) => {
      activeRequestRef.current?.abort();
      const controller = new AbortController();
      activeRequestRef.current = controller;
      setError(null);
      setRunning(true);
      try {
        const result = await runSatelliteSwarmSimulation(objective, {
          signal: controller.signal,
        });
        if (activeRequestRef.current === controller) {
          setSimulation((current) => ({
            data: result,
            runId: (current?.runId ?? 0) + 1,
            startPlaying,
          }));
        }
      } catch (runError) {
        if (
          activeRequestRef.current === controller &&
          (!(runError instanceof DOMException) ||
            runError.name !== "AbortError")
        ) {
          setError(messageFrom(runError));
        }
      } finally {
        if (activeRequestRef.current === controller) {
          activeRequestRef.current = null;
          setRunning(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let requested = false;
    const load = () => {
      if (requested) return;
      requested = true;
      setVisible(true);
      void run(SOUTH_POLE_OBJECTIVE);
    };

    if (typeof IntersectionObserver === "undefined") {
      load();
      return () => {
        const controller = activeRequestRef.current;
        activeRequestRef.current = null;
        controller?.abort();
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        load();
        observer.disconnect();
      },
      { rootMargin: "500px 0px" },
    );
    observer.observe(container);
    return () => {
      const controller = activeRequestRef.current;
      activeRequestRef.current = null;
      controller?.abort();
      observer.disconnect();
    };
  }, [run]);

  const resetObjective = () => {
    setLongitude(String(SOUTH_POLE_OBJECTIVE.longitudeDegrees));
    setLatitude(String(SOUTH_POLE_OBJECTIVE.latitudeDegrees));
    void run(SOUTH_POLE_OBJECTIVE, true);
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(
      {
        latitudeDegrees: Number(latitude),
        longitudeDegrees: Number(longitude),
      },
      true,
    );
  };

  return (
    <div ref={containerRef} aria-busy={running}>
      {simulation && visible ? (
        <SatelliteSwarmSimulation
          key={simulation.runId}
          data={simulation.data}
          executionMode="webassembly"
          missionControls={
            <MissionControls
              error={error}
              latitude={latitude}
              longitude={longitude}
              onLatitudeChange={setLatitude}
              onLongitudeChange={setLongitude}
              onReset={resetObjective}
              onSubmit={submit}
              running={running}
            />
          }
          startPlaying={simulation.startPlaying}
        />
      ) : (
        <Placeholder
          error={error}
          onRetry={() => void run(SOUTH_POLE_OBJECTIVE)}
        />
      )}
    </div>
  );
}
