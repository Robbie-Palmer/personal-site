import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(uiRoot, "out");
const nextChunks = path.join(outputRoot, "_next", "static", "chunks");

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

const files = [
  ...(await javascriptFiles(nextChunks)),
  path.join(outputRoot, "cesium", "Cesium.js"),
];
for (const file of files) {
  const source = await readFile(file, "utf8");
  new vm.Script(source, { filename: path.relative(uiRoot, file) });
}

console.log(`Parsed ${files.length} exported JavaScript files.`);
