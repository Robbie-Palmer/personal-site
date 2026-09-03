import path from "node:path";
import type { PipelineParams } from "./schemas";

export type ChangeSize = "small" | "medium" | "substantial" | "large" | "oversized";

export function changeSizeBand(
  changedLines: number,
  thresholds: PipelineParams["cohort"]["changeSizeThresholds"],
): ChangeSize {
  if (changedLines < thresholds.medium) return "small";
  if (changedLines < thresholds.substantial) return "medium";
  if (changedLines < thresholds.large) return "substantial";
  if (changedLines < thresholds.oversized) return "large";
  return "oversized";
}

const LANGUAGE_BY_EXTENSION = new Map<string, string>([
  [".c", "c"], [".cc", "cpp"], [".cpp", "cpp"], [".cs", "csharp"],
  [".css", "css"], [".go", "go"], [".html", "html"], [".java", "java"],
  [".js", "javascript"], [".jsx", "javascript"], [".json", "json"],
  [".kt", "kotlin"], [".md", "markdown"], [".mdx", "mdx"], [".mjs", "javascript"],
  [".php", "php"], [".py", "python"], [".rb", "ruby"], [".rs", "rust"],
  [".sh", "shell"], [".sql", "sql"], [".tf", "terraform"], [".toml", "toml"],
  [".ts", "typescript"], [".tsx", "typescript"], [".vue", "vue"],
  [".yaml", "yaml"], [".yml", "yaml"],
]);

export function languagesForPaths(paths: string[] | undefined): string[] {
  const languages = new Set<string>();
  for (const file of paths ?? []) {
    const language = LANGUAGE_BY_EXTENSION.get(path.extname(file).toLowerCase());
    if (language) languages.add(language);
  }
  return [...languages].sort((left, right) => left.localeCompare(right));
}

export function outcomeClass(outcome: unknown): "accepted" | "rejected" | "censored" | "no-response" | "missing" {
  if (outcome === "confirmed-fixed" || outcome === "acknowledged") return "accepted";
  if (outcome === "rejected") return "rejected";
  if (outcome === "superseded") return "censored";
  if (outcome === "no-observable-response") return "no-response";
  return "missing";
}
