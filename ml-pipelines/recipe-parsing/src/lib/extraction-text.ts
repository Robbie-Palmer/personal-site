interface ExtractionTextShape {
  title: string;
  description?: string;
  cuisine?: string;
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  ingredientGroups: { name?: string; lines: string[] }[];
  instructions: string[];
}

/**
 * Flatten an ExtractionRecipe into a single text string for text-fidelity
 * metric comparison (ROUGE-L, WER, CER). Equipment is excluded because it
 * is not evaluated as part of extraction quality.
 */
export function flattenExtractionText(extraction: ExtractionTextShape): string {
  const lines: string[] = [];

  lines.push(extraction.title);
  if (extraction.description) lines.push(extraction.description);
  if (extraction.cuisine) lines.push(`Cuisine ${extraction.cuisine}`);
  if (extraction.servings) lines.push(`Servings ${extraction.servings}`);
  if (extraction.prepTime) lines.push(`Prep time ${extraction.prepTime}`);
  if (extraction.cookTime) lines.push(`Cook time ${extraction.cookTime}`);

  for (const group of extraction.ingredientGroups) {
    if (group.name) lines.push(group.name);
    lines.push(...group.lines);
  }

  lines.push(...extraction.instructions);

  return lines.join("\n");
}
