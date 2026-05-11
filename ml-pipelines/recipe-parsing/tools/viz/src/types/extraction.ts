import type { ParsedRecipe } from "recipe-domain";

/** Text-based extraction — captures what the image literally says */
export interface ExtractionRecipe {
  title: string;
  description?: string;
  cuisine?: string;
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  ingredientGroups: { name?: string; lines: string[] }[];
  instructions: string[];
  equipment?: string[];
}

export interface CooklangFrontmatter {
  title?: string;
  description?: string;
  cuisine?: string[];
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  tags: string[];
  ingredientAnnotations?: Record<string, { preparation?: string; note?: string }>;
}

export interface CooklangRecipe {
  frontmatter: CooklangFrontmatter;
  body: string;
  diagnostics: string[];
  derived?: ParsedRecipe;
}

export interface GroundTruthEntry {
  images: string[];
  expected: ParsedRecipe;
  expectedExtraction?: ExtractionRecipe;
  expectedNormalization?: CooklangRecipe;
}

export interface GroundTruthDataset {
  entries: GroundTruthEntry[];
}

export interface PredictionEntry {
  images: string[];
  predicted: ParsedRecipe;
}

export interface PredictionsDataset {
  entries: PredictionEntry[];
}

export interface ExtractionPredictionEntry {
  images: string[];
  extracted: ExtractionRecipe;
}

export interface ExtractionPredictionsDataset {
  entries: ExtractionPredictionEntry[];
}

export interface CooklangPredictionEntry {
  images: string[];
  cooklang: CooklangRecipe;
}

export interface CooklangPredictionsDataset {
  entries: CooklangPredictionEntry[];
}

export interface PerImageScoreEntry {
  images: string[];
  scores: {
    overall: number;
    scalarFields: number;
    ingredientParsing: number;
    instructions: number;
    equipmentParsing?: number;
  };
  textFidelity?: {
    wordErrorRate: number;
    charErrorRate: number;
    rougeL: { precision: number; recall: number; f1: number };
  };
}

export interface StageMetrics {
  overall: { score: number };
  byCategory: {
    scalarFields: Record<string, { precision?: number; recall?: number; f1?: number; accuracy?: number }>;
    ingredientParsing: {
      precision: number;
      recall: number;
      f1: number;
      fieldScores?: {
        name?: { precision?: number; recall?: number; f1?: number };
        amount?: { accuracy?: number };
        unit?: { accuracy?: number };
        preparation?: { precision?: number; recall?: number; f1?: number };
      };
    };
    equipmentParsing?: { precision: number; recall: number; f1: number };
    instructions: { precision: number; recall: number; f1: number };
  };
  diagnostics?: {
    extractionText?: {
      wordErrorRate: number;
      charErrorRate: number;
      rougeL: { precision: number; recall: number; f1: number };
    };
  };
  entryCount: number;
}

export interface ExtractionEntry {
  index: number;
  images: string[];
  expected: ParsedRecipe;
  predicted: ParsedRecipe | null;
  predictedExtraction: ExtractionRecipe | null;
  expectedExtraction: ExtractionRecipe | null;
  predictedCooklang: CooklangRecipe | null;
}

export interface CooklangEntry {
  index: number;
  images: string[];
  expected: ParsedRecipe;
  predicted: ParsedRecipe | null;
  predictedCooklang: CooklangRecipe | null;
  expectedNormalization: CooklangRecipe | null;
}
