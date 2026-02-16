import {
  loadPreparedData,
  writeJson,
  PREDICTIONS_PATH,
} from "../lib/io";
import type { Recipe, PredictionsDataset } from "../schemas/ground-truth";

const DUMMY_INGREDIENTS = [
  "chicken-breast",
  "onion",
  "garlic",
  "olive-oil",
  "salt",
  "black-pepper",
  "pasta",
  "rice",
] as const;

const DUMMY_UNITS = ["g", "ml", "piece", "tsp", "tbsp"] as const;

const DUMMY_CUISINES = ["Italian", "Asian", "Spanish", "British"] as const;

function randomFrom<T>(arr: readonly T[]): T {
  if (arr.length === 0) {
    throw new Error("randomFrom called with empty array");
  }
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function generateDummyPrediction(_imageFiles: string[]): Recipe {
  const numIngredients = Math.floor(Math.random() * 6) + 3;
  const items = Array.from({ length: numIngredients }, () => ({
    ingredient: randomFrom(DUMMY_INGREDIENTS),
    amount: Math.floor(Math.random() * 400) + 10,
    unit: randomFrom(DUMMY_UNITS),
  }));

  const numInstructions = Math.floor(Math.random() * 5) + 2;
  const instructions = Array.from(
    { length: numInstructions },
    (_, i) => `Dummy instruction step ${i + 1}.`,
  );

  return {
    title: `Predicted Recipe`,
    description: "Dummy prediction from placeholder algorithm.",
    cuisine: randomFrom(DUMMY_CUISINES),
    servings: Math.floor(Math.random() * 4) + 1,
    prepTime: Math.floor(Math.random() * 30) + 5,
    cookTime: Math.floor(Math.random() * 45) + 10,
    ingredientGroups: [{ items }],
    instructions,
  };
}

async function main() {
  console.log("Loading prepared data...");
  const prepared = await loadPreparedData();

  console.log(`Running dummy inference on ${prepared.entries.length} entries...`);

  const predictions: PredictionsDataset = {
    entries: prepared.entries.map((entry) => ({
      images: entry.images,
      predicted: generateDummyPrediction(entry.images),
    })),
  };

  await writeJson(PREDICTIONS_PATH, predictions);
  console.log(
    `Generated ${predictions.entries.length} dummy predictions → ${PREDICTIONS_PATH}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
