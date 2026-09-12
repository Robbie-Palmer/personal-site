import type { CesiumRuntime } from "./cesium-runtime";

const CESIUM_RUNTIME_PATH = "/cesium/index.js";

export async function importCesiumRuntime(): Promise<CesiumRuntime> {
  const runtime = await import(/* webpackIgnore: true */ CESIUM_RUNTIME_PATH);
  return runtime as CesiumRuntime;
}
