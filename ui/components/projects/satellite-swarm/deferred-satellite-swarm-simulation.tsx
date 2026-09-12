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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SatelliteSwarmSimulation as SimulationData } from "@/lib/api/satellite-swarm-simulation";
import {
  runSatelliteSwarmSimulation,
  type SatelliteSwarmObjective,
  type SatelliteSwarmScenario,
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
  activated,
  error,
  onActivate,
}: Readonly<{
  activated: boolean;
  error: string | null;
  onActivate: () => void;
}>) {
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
            : activated
              ? "Loading the C++ WebAssembly module..."
              : "Load the WebAssembly simulation and 3D globe when you are ready."}
        </p>
      </div>
      <div className="flex h-72 flex-col items-center justify-center gap-4 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        {error ? (
          <>
            <p className="max-w-xl font-mono text-xs">{error}</p>
            <Button type="button" variant="outline" onClick={onActivate}>
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              Retry simulation
            </Button>
          </>
        ) : activated ? (
          <>
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span>Preparing the deterministic mission replay...</span>
          </>
        ) : (
          <>
            <p className="max-w-xl">
              This optional interactive downloads CesiumJS and the compiled C++
              module. The rest of the page works without them.
            </p>
            <Button type="button" onClick={onActivate}>
              Load simulation
            </Button>
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
  onScenarioChange: (value: SatelliteSwarmScenario) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  running: boolean;
  scenario: SatelliteSwarmScenario;
}

function MissionControls({
  error,
  latitude,
  longitude,
  onLatitudeChange,
  onLongitudeChange,
  onReset,
  onScenarioChange,
  onSubmit,
  running,
  scenario,
}: Readonly<MissionControlsProps>) {
  return (
    <form
      className="mt-4 grid gap-3 rounded-lg border bg-background/60 p-3 sm:grid-cols-[1fr_1fr_1.3fr_auto_auto] sm:items-end"
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
      <label
        className="space-y-1 text-xs font-medium"
        htmlFor="satellite-swarm-scenario"
      >
        <span>Network scenario</span>
        <Select
          value={scenario}
          onValueChange={(value) => {
            if (value === "nominal" || value === "lost-assignment") {
              onScenarioChange(value);
            }
          }}
        >
          <SelectTrigger id="satellite-swarm-scenario" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="nominal">All deliveries</SelectItem>
            <SelectItem value="lost-assignment">
              Lose winning assignment
            </SelectItem>
          </SelectContent>
        </Select>
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
      <p className="text-xs text-muted-foreground sm:col-span-5">
        Run mission recalculates the C++ trace. The controls below play, pause,
        or inspect that result.
      </p>
      {error && (
        <p
          id="satellite-swarm-run-error"
          className="text-xs text-destructive sm:col-span-5"
          role="alert"
        >
          {error}
        </p>
      )}
    </form>
  );
}

export function DeferredSatelliteSwarmSimulation() {
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
  const [scenario, setScenario] = useState<SatelliteSwarmScenario>("nominal");
  const [running, setRunning] = useState(false);
  const [activated, setActivated] = useState(false);

  const run = useCallback(
    async (
      objective: SatelliteSwarmObjective,
      startPlaying = false,
      selectedScenario: SatelliteSwarmScenario = "nominal",
    ) => {
      activeRequestRef.current?.abort();
      const controller = new AbortController();
      activeRequestRef.current = controller;
      setError(null);
      setRunning(true);
      try {
        const result = await runSatelliteSwarmSimulation(objective, {
          scenario: selectedScenario,
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
    return () => {
      const controller = activeRequestRef.current;
      activeRequestRef.current = null;
      controller?.abort();
    };
  }, []);

  const activate = () => {
    setActivated(true);
    void run(SOUTH_POLE_OBJECTIVE);
  };

  const resetObjective = () => {
    setLongitude(String(SOUTH_POLE_OBJECTIVE.longitudeDegrees));
    setLatitude(String(SOUTH_POLE_OBJECTIVE.latitudeDegrees));
    void run(SOUTH_POLE_OBJECTIVE, true, scenario);
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(
      {
        latitudeDegrees: Number(latitude),
        longitudeDegrees: Number(longitude),
      },
      true,
      scenario,
    );
  };

  return (
    <div aria-busy={running}>
      {simulation && activated ? (
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
              onScenarioChange={setScenario}
              onSubmit={submit}
              running={running}
              scenario={scenario}
            />
          }
          startPlaying={simulation.startPlaying}
        />
      ) : (
        <Placeholder
          activated={activated}
          error={error}
          onActivate={activate}
        />
      )}
    </div>
  );
}
