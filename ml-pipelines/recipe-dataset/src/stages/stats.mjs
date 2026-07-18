import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";

const projectRoot = new URL("../..", import.meta.url).pathname;
const outputs = `${projectRoot}/outputs`;
await mkdir(outputs, { recursive: true });
const bySource = new Map();
const titleCounts = new Map();
const signatureCounts = new Map();
let recipes = 0;
let ingredientLines = 0;
let instructionSteps = 0;
let equipmentItems = 0;
let recipesWithEquipment = 0;
let gutenbergCandidates = 0;
let ingredientOnlyRecords = 0;
const seenSignatures = new Set();
const canonicalBySignature = new Map();

for await (const line of createInterface({ input: createReadStream(`${outputs}/recipes.jsonl`), crlfDelay: Infinity })) {
  if (!line.trim()) continue;
  const recipe = JSON.parse(line);
  recipes += 1;
  bySource.set(recipe.sourceDataset, (bySource.get(recipe.sourceDataset) || 0) + 1);
  const title = recipe.title.toLocaleLowerCase("en");
  titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
  signatureCounts.set(recipe.contentSignature, (signatureCounts.get(recipe.contentSignature) || 0) + 1);
  ingredientLines += recipe.ingredientGroups.reduce((sum, group) => sum + group.items.length, 0);
  instructionSteps += recipe.instructions.length;
  const equipment = Array.isArray(recipe.equipment) ? recipe.equipment : [];
  equipmentItems += equipment.length;
  if (equipment.length) recipesWithEquipment += 1;
  seenSignatures.add(recipe.contentSignature);
  const variant = {
    sourceDataset: recipe.sourceDataset,
    sourceRecordId: recipe.sourceRecordId,
    sourceUrl: recipe.sourceUrl,
    license: recipe.license,
    category: recipe.category,
  };
  const canonical = canonicalBySignature.get(recipe.contentSignature);
  if (!canonical) {
    canonicalBySignature.set(recipe.contentSignature, {
      ...recipe,
      categories: recipe.category ? [recipe.category] : [],
      sourceVariants: [variant],
    });
  } else {
    if (recipe.category && !canonical.categories.includes(recipe.category)) {
      canonical.categories.push(recipe.category);
    }
    if (!canonical.sourceVariants.some((item) =>
      item.sourceDataset === variant.sourceDataset && item.sourceRecordId === variant.sourceRecordId)) {
      canonical.sourceVariants.push(variant);
    }
    for (const item of recipe.equipment || []) {
      if (!canonical.equipment.includes(item)) canonical.equipment.push(item);
    }
  }
}
const deduplicatedPath = `${outputs}/recipes-deduplicated.jsonl.part`;
const deduplicated = createWriteStream(deduplicatedPath, { encoding: "utf8" });
for (const recipe of canonicalBySignature.values()) deduplicated.write(`${JSON.stringify(recipe)}\n`);
await new Promise((resolve, reject) => deduplicated.end((error) => error ? reject(error) : resolve()));
await rename(deduplicatedPath, `${outputs}/recipes-deduplicated.jsonl`);
let rejects = 0;
for await (const line of createInterface({ input: createReadStream(`${outputs}/rejects.jsonl`), crlfDelay: Infinity })) {
  if (line.trim()) rejects += 1;
}
for await (const line of createInterface({ input: createReadStream(`${outputs}/gutenberg-candidates.jsonl`), crlfDelay: Infinity })) {
  if (line.trim()) gutenbergCandidates += 1;
}
for await (const line of createInterface({ input: createReadStream(`${outputs}/ingredient-only.jsonl`), crlfDelay: Infinity })) {
  if (line.trim()) ingredientOnlyRecords += 1;
}
const duplicateTitles = [...titleCounts.values()].filter((count) => count > 1).length;
const duplicateContent = [...signatureCounts.values()].filter((count) => count > 1).length;
const metrics = {
  recipes,
  rejects,
  sources: Object.fromEntries([...bySource].sort(([left], [right]) => left.localeCompare(right))),
  duplicateTitleGroups: duplicateTitles,
  duplicateContentGroups: duplicateContent,
  uniqueContentRecipes: seenSignatures.size,
  excessDuplicateRecords: recipes - seenSignatures.size,
  averageIngredientLines: recipes ? ingredientLines / recipes : 0,
  averageInstructionSteps: recipes ? instructionSteps / recipes : 0,
  recipesWithEquipment,
  equipmentItems,
  gutenbergCandidates,
  ingredientOnlyRecords,
};
await writeFile(`${outputs}/metrics.json`, `${JSON.stringify(metrics, null, 2)}\n`);
await writeFile(`${outputs}/source-distribution.json`, `${JSON.stringify([...bySource].map(([source, count]) => ({ source, count })), null, 2)}\n`);
console.log(JSON.stringify(metrics, null, 2));
