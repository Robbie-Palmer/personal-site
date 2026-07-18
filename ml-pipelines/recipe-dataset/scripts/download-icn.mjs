import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename } from "node:fs/promises";

const outputDirectory = process.argv[2];
if (!outputDirectory) throw new Error("Output directory is required");
await mkdir(outputDirectory, { recursive: true });
const outputPath = `${outputDirectory}/recipes.jsonl`;
const temporaryPath = `${outputPath}.part`;
const output = createWriteStream(temporaryPath, { encoding: "utf8" });
const endpoint = "https://theicn.org/cnrb/wp-json/wp/v2/posts";
let written = 0;

for (let page = 1; ; page += 1) {
  const response = await fetch(
    `${endpoint}?per_page=100&page=${page}&_fields=id,link,title,content`,
    { headers: { "user-agent": "RecipeDatasetResearch/1.0" } },
  );
  if (!response.ok) throw new Error(`ICN post page ${page}: HTTP ${response.status}`);
  const posts = await response.json();
  for (const post of posts) {
    if (!/\/recipes-/i.test(post.link)) continue;
    const html = post.content?.rendered || "";
    if (!/wprm-recipe-container/.test(html)) continue;
    output.write(`${JSON.stringify({
      sourceUrl: post.link,
      sourceRecordId: String(post.id),
      sourceChecksum: createHash("sha256").update(html).digest("hex"),
      title: post.title?.rendered || "",
      html,
    })}\n`);
    written += 1;
  }
  if (page >= Number(response.headers.get("x-wp-totalpages") || 1)) break;
}

await new Promise((resolve, reject) => output.end((error) => error ? reject(error) : resolve()));
await rename(temporaryPath, outputPath);
console.log(`Downloaded ${written} rendered ICN recipe posts.`);
