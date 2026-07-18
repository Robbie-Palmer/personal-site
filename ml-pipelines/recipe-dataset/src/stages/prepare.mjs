import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";

const projectRoot = new URL("../..", import.meta.url).pathname;
const raw = `${projectRoot}/data/raw`;
const outputs = `${projectRoot}/outputs`;
await mkdir(outputs, { recursive: true });
const recipesTemporary = `${outputs}/recipes.jsonl.part`;
const rejectsTemporary = `${outputs}/rejects.jsonl.part`;
const recipes = createWriteStream(recipesTemporary, { encoding: "utf8" });
const rejects = createWriteStream(rejectsTemporary, { encoding: "utf8" });
const gutenbergCandidatesTemporary = `${outputs}/gutenberg-candidates.jsonl.part`;
const gutenbergCandidates = createWriteStream(gutenbergCandidatesTemporary, { encoding: "utf8" });
const ingredientOnlyTemporary = `${outputs}/ingredient-only.jsonl.part`;
const ingredientOnly = createWriteStream(ingredientOnlyTemporary, { encoding: "utf8" });
let accepted = 0;
let rejected = 0;

function strings(value) {
  return Array.isArray(value)
    ? value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean)
    : [];
}

function instructionText(value) {
  return typeof value === "string"
    ? value.replace(/^\s*\d+[.)]\s*/, "").trim()
    : "";
}

function htmlText(value) {
  const entities = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

function htmlClassItems(html, className) {
  const pattern = new RegExp(`<li[^>]+class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/li>`, "gi");
  return [...html.matchAll(pattern)].map((match) => htmlText(match[1])).filter(Boolean);
}

function emit(source, value) {
  try {
    const title = typeof value.title === "string" ? value.title.trim() : "";
    const ingredientGroups = Array.isArray(value.ingredientGroups)
      ? value.ingredientGroups
          .map((group) => ({ name: group.name || undefined, items: strings(group.items) }))
          .filter((group) => group.items.length)
      : [];
    const instructions = strings(value.instructions);
    if (!title || ingredientGroups.length === 0 || instructions.length === 0) {
      throw new Error("missing title, ingredients, or instructions");
    }
    const signature = createHash("sha256")
      .update(JSON.stringify({ title, ingredientGroups, instructions }))
      .digest("hex");
    recipes.write(`${JSON.stringify({
      sourceDataset: source.id,
      sourceRecordId: value.sourceRecordId || signature,
      sourceUrl: value.sourceUrl || source.url,
      license: source.license,
      retrievedAt: "2026-07-18",
      sourceChecksum: value.sourceChecksum || signature,
      contentSignature: signature,
      title,
      description: typeof value.description === "string" ? value.description.trim() : "",
      cuisine: strings(value.cuisine),
      category: typeof value.category === "string" ? value.category.trim() : "",
      servings: value.servings,
      prepTime: value.prepTime,
      cookTime: value.cookTime,
      ingredientGroups,
      instructions,
      nutrition: value.nutrition,
      equipment: strings(value.equipment),
    })}\n`);
    accepted += 1;
  } catch (error) {
    rejects.write(`${JSON.stringify({ sourceDataset: source.id, error: error.message, value })}\n`);
    rejected += 1;
  }
}

async function linesFromStream(stream, callback) {
  for await (const line of createInterface({ input: stream, crlfDelay: Infinity })) {
    if (line.trim()) callback(JSON.parse(line));
  }
}

const kaggle = { id: "kaggle-64k", url: "https://www.kaggle.com/datasets/prashantsingh001/recipes-dataset-64k-dishes", license: "CC0-1.0" };
const unzip = spawn("unzip", ["-p", `${raw}/kaggle-64k/archive.zip`, "2_Recipe_json.json"]);
const unzipClosed = new Promise((resolve) => unzip.on("close", resolve));
await linesFromStream(unzip.stdout, (row) => emit(kaggle, {
  sourceRecordId: createHash("sha256").update(JSON.stringify(row)).digest("hex"),
  title: row.recipe_title,
  description: row.description,
  category: row.category,
  ingredientGroups: [{ items: row.ingredients }],
  instructions: row.directions,
}));
if ((await unzipClosed) !== 0) throw new Error("unzip failed");

const myplate = { id: "usda-myplate", url: "https://myplate.food/recipes", license: "Public Domain Mark" };
await linesFromStream(createReadStream(`${raw}/usda-myplate/recipes.jsonl`), (row) => {
  const recipe = row.recipe;
  emit(myplate, {
    sourceRecordId: new URL(row.sourceUrl).pathname.split("/").pop(),
    sourceUrl: row.sourceUrl,
    sourceChecksum: row.sourceChecksum,
    title: recipe.name,
    description: recipe.description,
    cuisine: typeof recipe.recipeCuisine === "string" ? [recipe.recipeCuisine] : recipe.recipeCuisine,
    category: recipe.recipeCategory,
    servings: recipe.recipeYield,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    ingredientGroups: [{ items: recipe.recipeIngredient }],
    instructions: (recipe.recipeInstructions || []).map((step) => typeof step === "string" ? step : step.text),
    nutrition: recipe.nutrition,
  });
});

const wikibooks = { id: "wikibooks-cookbook", url: "https://huggingface.co/datasets/gossminn/wikibooks-cookbook", license: "CC-BY-SA-4.0" };
const wikibooksRows = JSON.parse(await readFile(`${raw}/wikibooks-cookbook/recipes_parsed.json`, "utf8"));
for (const row of wikibooksRows) {
  const data = row.recipe_data;
  const linesBySection = new Map();
  for (const line of data.text_lines) {
    if (!line.section) continue;
    const sectionLines = linesBySection.get(line.section) || [];
    sectionLines.push(line);
    linesBySection.set(line.section, sectionLines);
  }
  const mixedRecipeSections = new Set(
    [...linesBySection]
      .filter(
        ([section, lines]) =>
          !/note|equipment|warning|reference|external|conversion|use/i.test(section) &&
          lines.some((line) => line.line_type === "ul") &&
          lines.some((line) => line.line_type === "ol"),
      )
      .map(([section]) => section),
  );
  const firstUnsectionedInstruction = data.text_lines.findIndex(
    (line) => !line.section && line.line_type === "ol",
  );
  const ingredients = data.text_lines
    .filter(
      (line, index) =>
        (/ingredient/i.test(line.section || "") &&
          ["ul", "ol", "p"].includes(line.line_type)) ||
        (mixedRecipeSections.has(line.section) && line.line_type === "ul") ||
        (firstUnsectionedInstruction >= 0 &&
          index < firstUnsectionedInstruction &&
          !line.section &&
          line.line_type === "ul"),
    )
    .map((line) => line.text);
  const equipment = data.text_lines
    .filter(
      (line) =>
        /equipment|utensil|cookware/i.test(line.section || "") &&
        ["ul", "ol", "p"].includes(line.line_type),
    )
    .map((line) => line.text);
  const instructions = data.text_lines
    .filter(
      (line) =>
        (/procedure|instruction|direction|method|preparation|process|^recipe$/i.test(
          line.section || "",
        ) && ["ol", "ul", "p"].includes(line.line_type)) ||
        (mixedRecipeSections.has(line.section) && line.line_type === "ol") ||
        (!line.section && line.line_type === "ol"),
    )
    .map((line) => instructionText(line.text))
    .filter(Boolean);
  emit(wikibooks, {
    sourceRecordId: row.filename,
    sourceUrl: data.url,
    title: data.title,
    category: data.infobox?.category,
    servings: data.infobox?.servings,
    ingredientGroups: [{ items: ingredients }],
    instructions,
    equipment,
  });
}

function archiveFiles(archive, pattern) {
  const result = spawnSync("tar", ["-tzf", archive], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `Could not list ${archive}`);
  return result.stdout.split("\n").filter((name) => pattern.test(name));
}

function archiveText(archive, name) {
  const result = spawnSync("tar", ["-xOzf", archive, name], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || `Could not read ${name}`);
  return result.stdout;
}

function markdownSection(source, heading) {
  const lines = source.split("\n");
  const headingPattern = new RegExp(`^(?:${heading})$`, "i");
  const start = lines.findIndex((line) => {
    const match = /^#{1,2}\s+(.+?)\s*$/.exec(line);
    return match && headingPattern.test(match[1].replace(/:\s*$/, ""));
  });
  if (start < 0) return "";
  const endOffset = lines.slice(start + 1).findIndex((line) => /^#{1,2}\s+/.test(line));
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset;
  return lines.slice(start + 1, end).join("\n");
}

const foss = { id: "fossrecipes", url: "https://github.com/thenaterhood/fossrecipes", license: "CC0-1.0" };
const fossArchive = `${raw}/fossrecipes/a6d8d27ba1cd7a2dcaf4dc5d84b7d5a7ab0eaf9c.tar.gz`;
for (const name of archiveFiles(fossArchive, /\/_recipes\/.*\.md$/)) {
  const source = archiveText(fossArchive, name);
  const title = /^title:\s*(.+)$/m.exec(source)?.[1]?.trim();
  const ingredientSource = markdownSection(source, "Ingredients");
  const directionSource = markdownSection(source, "Directions?|Instructions?|Method|Preparation");
  const equipmentSource = markdownSection(source, "Equipment|Utensils?|Cookware");
  emit(foss, {
    sourceRecordId: name.split("/").pop(),
    sourceUrl: `${foss.url}/blob/a6d8d27ba1cd7a2dcaf4dc5d84b7d5a7ab0eaf9c/${name.split("/").slice(1).join("/")}`,
    title,
    ingredientGroups: [{ items: [...ingredientSource.matchAll(/^\s*[*-]\s+(.+)$/gm)].map((match) => match[1]) }],
    instructions: directionSource
      .split(/\n\s*\n/)
      .map((block) => block.replace(/^\s*(?:\d+[.)]|[*-])\s+/, "").replace(/\s*\n\s*/g, " ").trim())
      .filter((block) => block && !/^#{1,6}\s/.test(block)),
    equipment: [...equipmentSource.matchAll(/^\s*[*-]\s+(.+)$/gm)].map((match) => match[1]),
  });
}

const koha = { id: "koha-cookbook", url: "https://gitlab.com/koha-community/koha-cookbook", license: "CC0-1.0" };
const kohaArchive = `${raw}/koha-cookbook/908b2244.tar.gz`;
for (const name of archiveFiles(kohaArchive, /\/source\/(?!index|conf)[^/]+\.rst$/)) {
  const source = archiveText(kohaArchive, name);
  const lines = source.split("\n");
  const titleIndex = lines.findIndex((line, index) => /^=+$/.test(lines[index + 1] || "") && line.trim());
  const title = titleIndex >= 0 ? lines[titleIndex].trim() : "";
  const ingredientStart = lines.findIndex((line) => /^Ingredients?$/i.test(line.trim()));
  const preparationStart = lines.findIndex((line) => /^(Preparation|Directions?|Method|Instructions?)$/i.test(line.trim()));
  const ingredientLines = ingredientStart >= 0 && preparationStart > ingredientStart
    ? lines.slice(ingredientStart + 2, preparationStart)
    : [];
  const instructionLines = preparationStart >= 0 ? lines.slice(preparationStart + 2) : [];
  emit(koha, {
    sourceRecordId: name.split("/").pop(),
    sourceUrl: `${koha.url}/-/blob/908b2244/${name.split("/").slice(1).join("/")}`,
    title,
    ingredientGroups: [{ items: ingredientLines.filter((line) => /^\s*-\s+\S/.test(line)).map((line) => line.replace(/^\s*-\s+/, "").trim()) }],
    instructions: instructionLines.filter((line) => /^\s*\d+[.)]\s+\S/.test(line)).map((line) => instructionText(line)),
  });
}

const icnPath = `${raw}/icn-child-nutrition/recipes.jsonl`;
try {
  const icn = { id: "icn-child-nutrition", url: "https://theicn.org/cnrb/", license: "Per-record provenance" };
  await linesFromStream(createReadStream(icnPath), (row) => {
    const html = row.html;
    const description = /class=["'][^"']*wprm-recipe-summary[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1];
    const servings = /data-servings=["']([^"']*)/i.exec(html)?.[1];
    emit(icn, {
      sourceRecordId: row.sourceRecordId,
      sourceUrl: row.sourceUrl,
      sourceChecksum: row.sourceChecksum,
      title: htmlText(row.title),
      description: htmlText(description),
      servings,
      ingredientGroups: [{ items: htmlClassItems(html, "wprm-recipe-ingredient") }],
      instructions: htmlClassItems(html, "wprm-recipe-instruction"),
      equipment: htmlClassItems(html, "wprm-recipe-equipment"),
    });
  });
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const gutenbergIds = JSON.parse(await readFile(`${raw}/gutenberg-cookbooks/ebook-ids.json`, "utf8"));
let gutenbergCandidateCount = 0;
for (const ebookId of gutenbergIds) {
  let book;
  try {
    book = await readFile(`${raw}/gutenberg-cookbooks/books/${ebookId}.txt`, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") continue;
    throw error;
  }
  const lines = book.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index].trim();
    if (!heading || heading.length > 90 || !/^[A-Z][A-Z0-9 '\-(),.&]+$/.test(heading)) continue;
    const bodyLines = [];
    for (let cursor = index + 1; cursor < Math.min(lines.length, index + 35); cursor += 1) {
      const line = lines[cursor].trim();
      if (bodyLines.length && /^[A-Z][A-Z0-9 '\-(),.&]+$/.test(line) && line.length <= 90) break;
      if (line) bodyLines.push(line);
    }
    const body = bodyLines.join(" ");
    if (body.length < 100 || !/\b(cup|tablespoon|teaspoon|ounce|pound|quart|lb\.?|oz\.?)\b/i.test(body)) continue;
    if (!/\b(add|bake|boil|cook|mix|stir|serve|heat|cut|chop|beat|place)\b/i.test(body)) continue;
    const sourceChecksum = createHash("sha256").update(`${ebookId}:${heading}:${body}`).digest("hex");
    gutenbergCandidates.write(`${JSON.stringify({
      sourceDataset: "gutenberg-cookbooks",
      sourceRecordId: `${ebookId}:${index + 1}`,
      sourceUrl: `https://www.gutenberg.org/ebooks/${ebookId}`,
      license: "Public domain in the USA; ebook header retained in raw source",
      sourceChecksum,
      ebookId,
      lineNumber: index + 1,
      title: heading.replace(/\s+/g, " "),
      body,
    })}\n`);
    gutenbergCandidateCount += 1;
  }
}

function csvRows(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted && character === '"' && source[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

let ingredientOnlyCount = 0;
for (const filename of ["all_recipes.csv", "cuisines.csv"]) {
  const rows = csvRows(await readFile(`${raw}/tastyr/${filename}`, "utf8"));
  const headers = rows.shift();
  for (const fields of rows) {
    const value = Object.fromEntries(headers.map((header, index) => [header, fields[index] || ""]));
    if (!value.name || !value.ingredients) continue;
    const sourceChecksum = createHash("sha256").update(fields.join("\u0000")).digest("hex");
    ingredientOnly.write(`${JSON.stringify({
      sourceDataset: "tastyr",
      sourceRecordId: sourceChecksum,
      sourceUrl: value.url,
      license: "CC0",
      retrievedAt: "2026-07-18",
      sourceChecksum,
      collection: filename.replace(".csv", ""),
      title: value.name,
      ingredientsText: value.ingredients,
      nutrition: {
        calories: value.calories,
        fat: value.fat,
        carbs: value.carbs,
        protein: value.protein,
      },
      prepTime: value.prep_time,
      cookTime: value.cook_time,
      totalTime: value.total_time,
      servings: value.servings,
      rating: value.avg_rating,
    })}\n`);
    ingredientOnlyCount += 1;
  }
}

await Promise.all([
  new Promise((resolve, reject) => recipes.end((error) => error ? reject(error) : resolve())),
  new Promise((resolve, reject) => rejects.end((error) => error ? reject(error) : resolve())),
  new Promise((resolve, reject) => gutenbergCandidates.end((error) => error ? reject(error) : resolve())),
  new Promise((resolve, reject) => ingredientOnly.end((error) => error ? reject(error) : resolve())),
]);
await rename(recipesTemporary, `${outputs}/recipes.jsonl`);
await rename(rejectsTemporary, `${outputs}/rejects.jsonl`);
await rename(gutenbergCandidatesTemporary, `${outputs}/gutenberg-candidates.jsonl`);
await rename(ingredientOnlyTemporary, `${outputs}/ingredient-only.jsonl`);
console.log(`Prepared ${accepted} recipes; rejected ${rejected} records; found ${gutenbergCandidateCount} Gutenberg candidates and ${ingredientOnlyCount} ingredient-only records.`);
