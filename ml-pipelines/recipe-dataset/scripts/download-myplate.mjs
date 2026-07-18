import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";

const projectRoot = new URL("..", import.meta.url).pathname;
const outputDirectory = `${projectRoot}/data/raw/usda-myplate`;
await mkdir(outputDirectory, { recursive: true });

function hasRecipeType(value) {
  const type = value?.["@type"];
  return type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
}

function findRecipe(value) {
  if (hasRecipeType(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const recipe = findRecipe(item);
      if (recipe) return recipe;
    }
  }
  if (value && typeof value === "object" && value["@graph"]) {
    return findRecipe(value["@graph"]);
  }
  return undefined;
}

const sitemapUrl = "https://myplate.food/sitemap-recipes-en.xml";
const sitemap = await fetch(sitemapUrl).then((response) => {
  if (!response.ok) throw new Error(`MyPlate sitemap returned ${response.status}`);
  return response.text();
});
await writeFile(`${outputDirectory}/sitemap-recipes-en.xml`, sitemap);

const urls = [...sitemap.matchAll(/<loc>(https:\/\/myplate\.food\/recipes\/[^<]+)<\/loc>/g)]
  .map((match) => match[1])
  .filter(Boolean);
const outputPath = `${outputDirectory}/recipes.jsonl`;
const temporaryPath = `${outputPath}.part`;
const output = createWriteStream(temporaryPath, { encoding: "utf8" });
let nextIndex = 0;
let written = 0;

async function worker() {
  while (nextIndex < urls.length) {
    const index = nextIndex++;
    const url = urls[index];
    let lastError;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: { "user-agent": "RecipeDatasetResearch/1.0" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const scripts = [...html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
        const recipe = scripts
          .map((match) => {
            try { return JSON.parse(match[1]); } catch { return null; }
          })
          .map(findRecipe)
          .find(Boolean);
        if (!recipe) throw new Error("Recipe JSON-LD missing");
        output.write(`${JSON.stringify({
          sourceUrl: url,
          sourceChecksum: createHash("sha256").update(html).digest("hex"),
          recipe,
        })}\n`);
        written += 1;
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
    if (lastError) throw new Error(`${url}: ${lastError.message}`);
  }
}

await Promise.all(Array.from({ length: 8 }, () => worker()));
await new Promise((resolve, reject) => output.end((error) => error ? reject(error) : resolve()));
await rename(temporaryPath, outputPath);
console.log(`Downloaded ${written} USDA MyPlate recipes.`);
