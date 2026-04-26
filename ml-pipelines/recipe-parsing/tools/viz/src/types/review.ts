import type { ParsedRecipe, RecipeIngredient } from "recipe-domain";

export interface ReviewManifest {
  generatedAt: string;
  entryCount: number;
  headlineMetrics: HeadlineMetrics;
  inferFailuresCount: number;
  categoryAggregates: CategoryAggregate[];
  unknownPredictedSlugs: { slug: string; count: number }[];
  rankings: Rankings;
  entries: ManifestEntry[];
}

export interface HeadlineMetrics {
  overallScore: number;
  ingredientParsingF1: number;
  instructionsF1: number;
  cuisineAccuracy: number;
  servingsAccuracy: number;
}

export interface CategoryAggregate {
  category: string;
  expectedCount: number;
  predictedCount: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
}

export interface Rankings {
  worstOverall: RankedEntry[];
  worstScalarFields: RankedEntry[];
  worstIngredientParsing: RankedEntry[];
  worstInstructions: RankedEntry[];
}

export interface RankedEntry {
  entryId: string;
  images: string[];
  score: number;
}

export interface ManifestEntry {
  entryId: string;
  entryFile: string;
  images: string[];
  scores: EntryScores;
  missingPrediction: boolean;
}

export interface EntryScores {
  overall: number;
  scalarFields: number;
  ingredientParsing: number;
  instructions: number;
}

// --- Detail entry (loaded per-entry) ---

export interface ReviewEntry {
  entryId: string;
  images: string[];
  imagePaths: string[];
  missingPrediction: boolean;
  scores: EntryScores;
  scalarFields: Record<string, ScalarFieldComparison>;
  ingredients: IngredientDiff;
  instructions: InstructionComparison;
  expectedRecipe: ParsedRecipe;
  predictedRecipe: ParsedRecipe;
}

export interface ScalarFieldComparison {
  expected: string | number | undefined;
  predicted?: string | number;
  match: boolean;
  f1?: { precision: number; recall: number; f1: number };
}

export interface AnnotatedIngredient {
  ingredient: RecipeIngredient;
  category: string;
}

export interface IngredientDiff {
  matched: { expected: AnnotatedIngredient; predicted: AnnotatedIngredient }[];
  missing: AnnotatedIngredient[];
  extra: AnnotatedIngredient[];
  amountMismatch: {
    expected: AnnotatedIngredient;
    predicted: AnnotatedIngredient;
  }[];
  unitMismatch: {
    expected: AnnotatedIngredient;
    predicted: AnnotatedIngredient;
  }[];
}

export interface InstructionComparison {
  expected: string[];
  predicted: string[];
  overlap: { precision: number; recall: number; f1: number };
  missingWords: string[];
  extraWords: string[];
}
