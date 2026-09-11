import { parentPort } from "node:worker_threads";

if (!parentPort) {
  throw new Error("The production worker harness requires a parent port.");
}

globalThis.self = {
  addEventListener(type, listener) {
    if (type !== "message") {
      throw new Error(`Unsupported worker event: ${type}`);
    }
    parentPort.on("message", (data) => listener({ data }));
  },
  postMessage(message) {
    parentPort.postMessage(message);
  },
};

await import(
  "../../../../ui/public/simulations/autonomic-satellite-swarm/satellite-swarm.worker.mjs"
);

parentPort.postMessage({ type: "ready" });
