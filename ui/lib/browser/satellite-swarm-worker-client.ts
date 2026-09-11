import { z } from "zod";
import {
  parseSatelliteSwarmSimulation,
  type SatelliteSwarmSimulation,
} from "@/lib/api/satellite-swarm-simulation";

export const SATELLITE_SWARM_WORKER_PROTOCOL_VERSION = 1 as const;

const WORKER_URL =
  "/simulations/autonomic-satellite-swarm/satellite-swarm.worker.mjs";
const WORKER_TIMEOUT_MS = 15_000;

const resultMessageSchema = z.object({
  protocolVersion: z.literal(SATELLITE_SWARM_WORKER_PROTOCOL_VERSION),
  requestId: z.string(),
  result: z.unknown(),
  type: z.literal("result"),
});

const errorMessageSchema = z.object({
  error: z.string().min(1),
  protocolVersion: z.literal(SATELLITE_SWARM_WORKER_PROTOCOL_VERSION),
  requestId: z.string(),
  type: z.literal("error"),
});

const responseMessageSchema = z.discriminatedUnion("type", [
  resultMessageSchema,
  errorMessageSchema,
]);

export interface SatelliteSwarmObjective {
  latitudeDegrees: number;
  longitudeDegrees: number;
}

export interface SatelliteSwarmRunOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

let requestSequence = 0;

function validateObjective(objective: SatelliteSwarmObjective) {
  if (
    !Number.isFinite(objective.longitudeDegrees) ||
    objective.longitudeDegrees < -180 ||
    objective.longitudeDegrees > 180
  ) {
    throw new RangeError("Longitude must be between -180 and 180 degrees.");
  }
  if (
    !Number.isFinite(objective.latitudeDegrees) ||
    objective.latitudeDegrees < -90 ||
    objective.latitudeDegrees > 90
  ) {
    throw new RangeError("Latitude must be between -90 and 90 degrees.");
  }
}

function abortError(): DOMException {
  return new DOMException(
    "The simulation request was cancelled.",
    "AbortError",
  );
}

export function runSatelliteSwarmSimulation(
  objective: SatelliteSwarmObjective,
  options: SatelliteSwarmRunOptions = {},
): Promise<SatelliteSwarmSimulation> {
  validateObjective(objective);
  if (options.signal?.aborted) return Promise.reject(abortError());
  if (typeof Worker === "undefined") {
    return Promise.reject(
      new Error("This browser does not support module Web Workers."),
    );
  }

  requestSequence += 1;
  const requestId = `satellite-swarm-${requestSequence}`;
  const worker = new Worker(WORKER_URL, {
    name: "satellite-swarm-simulation",
    type: "module",
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value: SatelliteSwarmSimulation) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      options.signal?.removeEventListener("abort", handleAbort);
      worker.terminate();
      resolve(value);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      options.signal?.removeEventListener("abort", handleAbort);
      worker.terminate();
      reject(
        error instanceof Error || error instanceof DOMException
          ? error
          : new Error(String(error)),
      );
    };
    const handleAbort = () => fail(abortError());

    const timeout = window.setTimeout(
      () =>
        fail(new Error("The WebAssembly simulation did not respond in time.")),
      options.timeoutMs ?? WORKER_TIMEOUT_MS,
    );

    options.signal?.addEventListener("abort", handleAbort, { once: true });
    worker.addEventListener("error", (event) => {
      fail(
        new Error(event.message || "The simulation worker could not start."),
      );
    });
    worker.addEventListener("message", (event: MessageEvent<unknown>) => {
      const parsed = responseMessageSchema.safeParse(event.data);
      if (!parsed.success || parsed.data.requestId !== requestId) return;
      if (parsed.data.type === "error") {
        fail(new Error(parsed.data.error));
        return;
      }
      try {
        finish(parseSatelliteSwarmSimulation(parsed.data.result));
      } catch (error) {
        fail(error);
      }
    });

    try {
      worker.postMessage({
        objective,
        protocolVersion: SATELLITE_SWARM_WORKER_PROTOCOL_VERSION,
        requestId,
        type: "run",
      });
    } catch (error) {
      fail(error);
    }
  });
}
