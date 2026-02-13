import { readFileSync, writeFileSync } from "node:fs";
import { GroundTruthDatasetSchema } from "../schemas/ground-truth";
import type { Recipe, PredictionsDataset } from "../schemas/ground-truth";

const PREPARED_PATH = "outputs/prepared.json";
const OUTPUT_PATH = "outputs/predictions.json";

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

console.log("Loading prepared data...");
const prepared = GroundTruthDatasetSchema.parse(
  JSON.parse(readFileSync(PREPARED_PATH, "utf-8")),
);

console.log(`Running dummy inference on ${prepared.entries.length} entries...`);

const predictions: PredictionsDataset = {
  entries: prepared.entries.map((entry) => ({
    images: entry.images,
    predicted: generateDummyPrediction(entry.images),
  })),
};

writeFileSync(OUTPUT_PATH, JSON.stringify(predictions, null, 2));
console.log(`Generated ${predictions.entries.length} dummy predictions → ${OUTPUT_PATH}`);
