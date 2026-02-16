import {
  loadGroundTruth,
  listImageFiles,
  writeJson,
  PREPARED_PATH,
  IMAGES_DIR,
} from "../lib/io";

async function main() {
  console.log("Loading ground truth data...");
  const dataset = await loadGroundTruth();
  console.log(`Validated ${dataset.entries.length} ground truth entries`);

  const files = await listImageFiles();
  const availableImages = new Set(files);

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

  await writeJson(PREPARED_PATH, dataset);
  console.log(`Prepared data written to ${PREPARED_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
