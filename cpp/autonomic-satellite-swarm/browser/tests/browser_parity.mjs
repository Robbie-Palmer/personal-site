import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import createSatelliteSwarmModule from "../../build/browser/browser/satellite-swarm.mjs";

const module = await createSatelliteSwarmModule();
assert.equal(module._satellite_swarm_browser_api_version(), 1);

function run(longitudeDegrees, latitudeDegrees) {
  const resultPointer = module._satellite_swarm_run_demonstration(
    longitudeDegrees,
    latitudeDegrees,
  );
  if (resultPointer === 0) {
    const errorPointer = module._satellite_swarm_last_error();
    throw new Error(module.UTF8ToString(errorPointer));
  }
  return module.UTF8ToString(resultPointer);
}

const fixtureUrl = new URL(
  "../../../../ui/public/simulations/autonomic-satellite-swarm/demonstration.v1.json",
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

assert.throws(
  () => run(181, 0),
  /mission objective is outside the coordinate bounds/,
);

console.log("Native fixture and WebAssembly output match.");
