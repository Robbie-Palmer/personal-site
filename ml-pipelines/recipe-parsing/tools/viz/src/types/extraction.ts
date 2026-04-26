import type { ParsedRecipe } from "recipe-domain";

export interface StructuredIngredientSection {
  name?: string;
  lines: string[];
}

export interface StructuredTimer {
  name?: string;
  text: string;
  quantity?: number;
  unit?: string;
}

export interface StructuredTextRecipe {
  title?: string;
  description?: string;
  cuisine?: string;
  servingsText?: string;
  prepTimeText?: string;
  cookTimeText?: string;
  ingredientSections: StructuredIngredientSection[];
  instructionLines: string[];
  notes: string[];
  equipment: string[];
  timers: StructuredTimer[];
}

export interface CooklangFrontmatter {
  title?: string;
  description?: string;
  cuisine?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  tags: string[];
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
  expectedExtraction?: ParsedRecipe;
  expectedStructuredText?: StructuredTextRecipe;
  expectedCooklang?: CooklangRecipe;
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

export interface StructuredTextPredictionEntry {
  images: string[];
  extracted: StructuredTextRecipe;
}

export interface StructuredTextPredictionsDataset {
  entries: StructuredTextPredictionEntry[];
}

export interface CooklangPredictionEntry {
  images: string[];
  cooklang: CooklangRecipe;
}

export interface CooklangPredictionsDataset {
  entries: CooklangPredictionEntry[];
}

export interface ExtractionEntry {
  index: number;
  images: string[];
  expected: ParsedRecipe;
  predicted: ParsedRecipe | null;
  predictedStructuredText: StructuredTextRecipe | null;
  expectedStructuredText: StructuredTextRecipe | null;
  predictedCooklang: CooklangRecipe | null;
}

export interface CooklangEntry {
  index: number;
  images: string[];
  expected: ParsedRecipe;
  predicted: ParsedRecipe | null;
  predictedCooklang: CooklangRecipe | null;
  expectedCooklang: CooklangRecipe | null;
}
