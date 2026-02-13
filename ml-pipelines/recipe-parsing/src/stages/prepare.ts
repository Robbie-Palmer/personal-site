import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { GroundTruthDatasetSchema } from "../schemas/ground-truth";

const GROUND_TRUTH_PATH = "data/ground-truth.json";
const IMAGES_DIR = "data/recipe-images";
const OUTPUT_PATH = "outputs/prepared.json";

async function main() {
  console.log("Loading ground truth data...");
  const raw = JSON.parse(readFileSync(GROUND_TRUTH_PATH, "utf-8"));
  const dataset = GroundTruthDatasetSchema.parse(raw);
  console.log(`Validated ${dataset.entries.length} ground truth entries`);

  const availableImages = existsSync(IMAGES_DIR)
    ? new Set(readdirSync(IMAGES_DIR).filter(
        (f) => f.endsWith(".jpg") || f.endsWith(".jpeg") || f.endsWith(".png"),
      ))
    : new Set<string>();
  const missingImages: string[] = [];
  for (const entry of dataset.entries) {
    for (const img of entry.images) {
      if (!availableImages.has(img)) {
        missingImages.push(img);
      }
    }
  }

  if (missingImages.length > 0) {
    console.warn(
      `\nWARNING: ${missingImages.length} referenced image(s) not found locally:`,
    );
    for (const img of missingImages) {
      console.warn(`  - ${img}`);
    }
    console.warn("Run 'dvc pull' to download images.\n");
  } else {
    console.log(`All referenced images found in ${IMAGES_DIR}.`);
  }

  mkdirSync("outputs", { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(dataset, null, 2));
  console.log(`Prepared data written to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
