import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const outputDirectory = process.argv[2];
if (!outputDirectory) throw new Error("Output directory is required");
const booksDirectory = `${outputDirectory}/books`;
await mkdir(booksDirectory, { recursive: true });

const ids = new Set();
for (let start = 1; ; start += 25) {
  const url = `https://www.gutenberg.org/ebooks/bookshelf/419?start_index=${start}`;
  const html = await fetch(url).then((response) => {
    if (!response.ok) throw new Error(`Gutenberg bookshelf returned ${response.status}`);
    return response.text();
  });
  const pageIds = [...html.matchAll(/href=["']\/ebooks\/(\d+)["']/g)].map((match) => match[1]);
  const previousSize = ids.size;
  for (const id of pageIds) ids.add(id);
  if (pageIds.length === 0 || ids.size === previousSize) break;
}

await writeFile(`${outputDirectory}/ebook-ids.json`, `${JSON.stringify([...ids].sort((a, b) => Number(a) - Number(b)), null, 2)}\n`);
let nextIndex = 0;
const orderedIds = [...ids];
async function worker() {
  while (nextIndex < orderedIds.length) {
    const id = orderedIds[nextIndex++];
    const destination = `${booksDirectory}/${id}.txt`;
    if (existsSync(destination)) continue;
    const candidates = [
      `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`,
      `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    ];
    let text;
    for (const url of candidates) {
      const response = await fetch(url, {
        headers: { "user-agent": "RecipeDatasetResearch/1.0" },
      });
      if (response.ok) {
        text = await response.text();
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!text) {
      console.warn(`Skipping Gutenberg ${id}: no UTF-8 text rendition`);
      continue;
    }
    await writeFile(destination, text);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
await Promise.all(Array.from({ length: 2 }, () => worker()));
console.log(`Catalogued ${ids.size} Project Gutenberg cookbooks.`);
