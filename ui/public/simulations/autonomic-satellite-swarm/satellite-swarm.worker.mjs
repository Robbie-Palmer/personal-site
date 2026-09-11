import createSatelliteSwarmModule from "./wasm/satellite-swarm.mjs";

const PROTOCOL_VERSION = 1;
const BROWSER_API_VERSION = 1;
let modulePromise;

function errorMessage(error) {
  return error instanceof Error && error.message
    ? error.message
    : "The WebAssembly simulation failed.";
}

function isCoordinate(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    Number.isFinite(value.longitudeDegrees) &&
    value.longitudeDegrees >= -180 &&
    value.longitudeDegrees <= 180 &&
    Number.isFinite(value.latitudeDegrees) &&
    value.latitudeDegrees >= -90 &&
    value.latitudeDegrees <= 90
  );
}

function loadModule() {
  modulePromise ??= createSatelliteSwarmModule({
    locateFile(path) {
      return new URL(`./wasm/${path}`, import.meta.url).href;
    },
  });
  return modulePromise;
}

function reply(requestId, message) {
  self.postMessage({
    protocolVersion: PROTOCOL_VERSION,
    requestId,
    ...message,
  });
}

self.addEventListener("message", async (event) => {
  const request = event.data;
  const requestId =
    typeof request?.requestId === "string" ? request.requestId : "unknown";

  if (
    request?.type !== "run" ||
    request?.protocolVersion !== PROTOCOL_VERSION ||
    !isCoordinate(request.objective)
  ) {
    reply(requestId, {
      error: "The simulation worker received an invalid request.",
      type: "error",
    });
    return;
  }

  try {
    const module = await loadModule();
    if (module._satellite_swarm_browser_api_version() !== BROWSER_API_VERSION) {
      throw new Error("The simulation worker API version does not match the site.");
    }

    const resultPointer = module._satellite_swarm_run_demonstration(
      request.objective.longitudeDegrees,
      request.objective.latitudeDegrees,
    );
    if (resultPointer === 0) {
      const errorPointer = module._satellite_swarm_last_error();
      throw new Error(module.UTF8ToString(errorPointer));
    }

    reply(requestId, {
      result: JSON.parse(module.UTF8ToString(resultPointer)),
      type: "result",
    });
  } catch (error) {
    modulePromise = undefined;
    reply(requestId, { error: errorMessage(error), type: "error" });
  }
});
