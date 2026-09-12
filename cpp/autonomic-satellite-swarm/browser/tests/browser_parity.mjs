import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import createSatelliteSwarmModule from "../../build/browser/browser/satellite-swarm.mjs";

const module = await createSatelliteSwarmModule();
assert.equal(module._satellite_swarm_browser_api_version(), 4);
const sourceRevision = module.UTF8ToString(
  module._satellite_swarm_source_revision(),
);
assert.match(sourceRevision, /^[0-9a-f]{40}$/);

function run(longitudeDegrees, latitudeDegrees, scenario = 0) {
  const resultPointer = module._satellite_swarm_run_demonstration(
    longitudeDegrees,
    latitudeDegrees,
    scenario,
  );
  if (resultPointer === 0) {
    const errorPointer = module._satellite_swarm_last_error();
    throw new Error(module.UTF8ToString(errorPointer));
  }
  return module.UTF8ToString(resultPointer);
}

const fixtureUrl = new URL(
  "../../../../ui/public/simulations/autonomic-satellite-swarm/demonstration.v3.json",
  import.meta.url,
);
const nativeFixture = await readFile(fixtureUrl, "utf8");
assert.equal(run(0, -90), nativeFixture);

const customResult = JSON.parse(run(14.25, -37.5));
assert.deepEqual(customResult.objective, {
  latitudeDegrees: -37.5,
  longitudeDegrees: 14.25,
});
assert.equal(customResult.frames.length, 4);
assert.ok(customResult.events.length > 0);

const faultResult = JSON.parse(run(0, -90, 1));
assert.equal(faultResult.scenario, "three-node-assignment-loss");
assert.ok(
  faultResult.events.some(
    (event) =>
      event.type === "message-dropped" &&
      event.nodeId === 0 &&
      event.recipientNode === 1,
  ),
);
assert.equal(faultResult.frames.at(-1).nodes[1].state, "idle");

assert.throws(
  () => run(181, 0),
  /mission objective is outside the coordinate bounds/,
);

const productionWorker = new Worker(
  new URL("./browser_worker_harness.mjs", import.meta.url),
);
try {
  const [readyMessage] = await once(productionWorker, "message");
  assert.deepEqual(readyMessage, { type: "ready" });

  const requestId = "browser-parity";
  productionWorker.postMessage({
    objective: { latitudeDegrees: -90, longitudeDegrees: 0 },
    protocolVersion: 3,
    requestId,
    scenario: "nominal",
    type: "run",
  });
  const [workerResponse] = await once(productionWorker, "message");
  assert.equal(workerResponse.protocolVersion, 3);
  assert.equal(workerResponse.requestId, requestId);
  assert.equal(workerResponse.sourceRevision, sourceRevision);
  assert.equal(workerResponse.type, "result");
  assert.deepEqual(workerResponse.result, JSON.parse(nativeFixture));

  const faultRequestId = "browser-parity-fault";
  productionWorker.postMessage({
    objective: { latitudeDegrees: -90, longitudeDegrees: 0 },
    protocolVersion: 3,
    requestId: faultRequestId,
    scenario: "lost-assignment",
    type: "run",
  });
  const [faultWorkerResponse] = await once(productionWorker, "message");
  assert.equal(faultWorkerResponse.requestId, faultRequestId);
  assert.equal(faultWorkerResponse.sourceRevision, sourceRevision);
  assert.equal(faultWorkerResponse.type, "result");
  assert.deepEqual(faultWorkerResponse.result, faultResult);
} finally {
  await productionWorker.terminate();
}

console.log("Native fixture, WebAssembly output, and production worker match.");
