import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(uiRoot, "out");
const nextChunks = path.join(outputRoot, "_next", "static", "chunks");
const CESIUM_SYNTAX_CHECK_TIMEOUT_MS = 30_000;

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return javascriptFiles(entryPath);
      return entry.isFile() && entry.name.endsWith(".js") ? [entryPath] : [];
    }),
  );
  return nested.flat();
}

const files = await javascriptFiles(nextChunks);
for (const file of files) {
  const check = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });
  if (check.status !== 0) {
    throw new Error(
      `Failed to parse ${path.relative(uiRoot, file)}:\n${check.stderr}`,
    );
  }
}

const cesiumModule = path.join(outputRoot, "cesium", "index.js");
const cesiumSource = await readFile(cesiumModule, "utf8");
const moduleCheck = spawnSync(
  process.execPath,
  ["--input-type=module", "--check"],
  {
    encoding: "utf8",
    input: cesiumSource,
    timeout: CESIUM_SYNTAX_CHECK_TIMEOUT_MS,
  },
);
if (moduleCheck.status !== 0) {
  const diagnostic = moduleCheck.error?.message ?? moduleCheck.stderr;
  throw new Error(
    `Failed to parse ${path.relative(uiRoot, cesiumModule)}:\n${diagnostic}`,
  );
}

console.log(`Parsed ${files.length + 1} exported JavaScript files.`);
