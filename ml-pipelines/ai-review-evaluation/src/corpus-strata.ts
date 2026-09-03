import path from "node:path";
import * as linguistLanguages from "linguist-languages";
import {
  BOUNDED_CHANGE_SIZE_NAMES,
  type ChangeSize,
  type PipelineParams,
} from "./schemas";

export function changeSizeBand(
  changedLines: number,
  bands: PipelineParams["cohort"]["changeSizeBands"],
): ChangeSize {
  for (const name of BOUNDED_CHANGE_SIZE_NAMES) {
    if (changedLines < bands[name].maxExclusive) return name;
  }
  return "oversized";
}

interface LinguistLanguage {
  name: string;
  extensions?: readonly string[];
  filenames?: readonly string[];
}

interface LanguageCandidate {
  language: string;
  preference: number;
}

function preferredLanguage(
  candidates: Map<string, LanguageCandidate>,
  key: string,
  candidate: LanguageCandidate,
): void {
  const current = candidates.get(key);
  if (!current || candidate.preference < current.preference ||
    (candidate.preference === current.preference && candidate.language.localeCompare(current.language) < 0)) {
    candidates.set(key, candidate);
  }
}

function languageMaps(): { byExtension: Map<string, string>; byFilename: Map<string, string> } {
  const extensionCandidates = new Map<string, LanguageCandidate>();
  const filenameCandidates = new Map<string, LanguageCandidate>();
  for (const definition of Object.values(linguistLanguages) as LinguistLanguage[]) {
    const language = definition.name.toLowerCase();
    for (const [preference, extension] of (definition.extensions ?? []).entries()) {
      preferredLanguage(extensionCandidates, extension.toLowerCase(), { language, preference });
    }
    for (const [preference, filename] of (definition.filenames ?? []).entries()) {
      preferredLanguage(filenameCandidates, filename.toLowerCase(), { language, preference });
    }
  }
  return {
    byExtension: new Map([...extensionCandidates].map(([key, value]) => [key, value.language])),
    byFilename: new Map([...filenameCandidates].map(([key, value]) => [key, value.language])),
  };
}

const { byExtension: LANGUAGE_BY_EXTENSION, byFilename: LANGUAGE_BY_FILENAME } = languageMaps();

export function languagesForPaths(paths: string[] | undefined): string[] {
  const languages = new Set<string>();
  for (const file of paths ?? []) {
    const language = LANGUAGE_BY_FILENAME.get(path.basename(file).toLowerCase())
      ?? LANGUAGE_BY_EXTENSION.get(path.extname(file).toLowerCase());
    if (language) languages.add(language);
  }
  return [...languages].sort((left, right) => left.localeCompare(right));
}

export const OUTCOME_LABELS = ["accepted", "rejected", "censored", "no-response", "missing"] as const;
export type OutcomeLabel = typeof OUTCOME_LABELS[number];

export function outcomeClass(outcome: unknown): OutcomeLabel {
  if (outcome === "confirmed-fixed" || outcome === "acknowledged") return "accepted";
  if (outcome === "rejected") return "rejected";
  if (outcome === "superseded") return "censored";
  if (outcome === "no-observable-response") return "no-response";
  return "missing";
}
