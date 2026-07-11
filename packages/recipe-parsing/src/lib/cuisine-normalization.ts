const COMPOUND_CUISINES = new Set([
  "indo-chinese",
  "tex-mex",
]);

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

export function normalizeCuisineLabels(cuisines: string[]): string[] {
  const normalized: string[] = [];

  for (const cuisine of cuisines) {
    const trimmed = cuisine.trim();
    if (!trimmed) continue;

    if (COMPOUND_CUISINES.has(trimmed.toLowerCase())) {
      normalized.push(trimmed);
      continue;
    }

    const segments = trimmed
      .split("-")
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    normalized.push(...(segments.length > 0 ? segments : [trimmed]));
  }

  return unique(normalized);
}
