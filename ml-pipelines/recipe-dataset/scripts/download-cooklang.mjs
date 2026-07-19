import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, stat } from "node:fs/promises";

const projectRoot = new URL("..", import.meta.url).pathname;
const rawDirectory = `${projectRoot}/data/raw`;
const catalog = JSON.parse(await readFile(`${projectRoot}/sources.json`, "utf8"));
const sources = catalog.filter((source) => source.format === "Cooklang");

async function fetchText(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "RecipeDatasetResearch/1.0" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }
  throw new Error(`${url}: ${lastError.message}`);
}

async function exists(path) {
  try {
    return (await stat(path)).size > 0;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

for (const source of sources) {
  const repository = new URL(source.url).pathname.replace(/^\//, "");
  const outputDirectory = `${rawDirectory}/${source.id}`;
  const outputPath = `${outputDirectory}/recipes.jsonl`;
  if (await exists(outputPath)) continue;

  const treeUrl = `https://api.github.com/repos/${repository}/git/trees/${source.revision}?recursive=1`;
  const tree = JSON.parse(await fetchText(treeUrl));
  if (tree.truncated) throw new Error(`${source.id}: GitHub returned a truncated tree`);
  const paths = tree.tree
    .filter((entry) => entry.type === "blob" && entry.path.toLowerCase().endsWith(".cook"))
    .map((entry) => entry.path)
    .sort((left, right) => left.localeCompare(right));

  await mkdir(outputDirectory, { recursive: true });
  const temporaryPath = `${outputPath}.part`;
  const output = createWriteStream(temporaryPath, { encoding: "utf8" });
  const recipes = new Array(paths.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < paths.length) {
      const index = nextIndex++;
      const path = paths[index];
      const rawUrl = `https://raw.githubusercontent.com/${repository}/${source.revision}/${path}`;
      const text = await fetchText(rawUrl);
      recipes[index] = {
        path,
        sourceUrl: `${source.url}/blob/${source.revision}/${path}`,
        sourceChecksum: createHash("sha256").update(text).digest("hex"),
        text,
      };
    }
  }
  await Promise.all(Array.from({ length: 12 }, () => worker()));
  for (const recipe of recipes) output.write(`${JSON.stringify(recipe)}\n`);
  await new Promise((resolve, reject) => output.end((error) => error ? reject(error) : resolve()));
  await rename(temporaryPath, outputPath);
  console.log(`Downloaded ${paths.length} Cooklang recipes from ${repository}.`);
}
