import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cesiumBuild = path.join(uiRoot, "node_modules", "cesium", "Build", "Cesium");
const destination = path.join(uiRoot, "public", "cesium");
const runtimeEntries = [
  "Assets",
  "Cesium.js",
  "ThirdParty",
  "Widgets",
  "Workers",
];

await rm(destination, { force: true, recursive: true });
await mkdir(destination, { recursive: true });
await Promise.all(
  runtimeEntries.map((entry) =>
    cp(path.join(cesiumBuild, entry), path.join(destination, entry), {
      recursive: true,
    }),
  ),
);
