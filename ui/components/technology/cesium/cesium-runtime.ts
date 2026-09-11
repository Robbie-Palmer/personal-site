import type * as CesiumModule from "cesium";
import { importCesiumRuntime } from "./import-cesium-runtime";

export type CesiumRuntime = typeof CesiumModule;

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}

let runtimePromise: Promise<CesiumRuntime> | undefined;

export function loadCesiumRuntime(): Promise<CesiumRuntime> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Cesium requires a browser"));
  }

  window.CESIUM_BASE_URL = "/cesium/";
  if (runtimePromise) return runtimePromise;

  runtimePromise = importCesiumRuntime().catch((error: unknown) => {
    runtimePromise = undefined;
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new Error(`The self-hosted Cesium runtime failed to load${detail}`);
  });

  return runtimePromise;
}
