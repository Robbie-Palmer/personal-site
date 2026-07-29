/**
 * Pure spell-check engine for the recipe editor. Mirrors the `typos` tool: it
 * flags only words present in the curated known-typos dictionary (see
 * ui/scripts/generate-typos-dictionary.ts), so false positives stay rare.
 *
 * Everything here is I/O-free and offset-accurate so the editor can highlight
 * ranges in the raw Cooklang source and rewrite them in place. Dictionary
 * loading lives in ./typoDictionary.
 */

/** A flagged word with its range in the source and case-matched suggestions. */
export interface Misspelling {
  /** Inclusive start offset into the source text. */
  readonly start: number;
  /** Exclusive end offset into the source text. */
  readonly end: number;
  /** The exact substring flagged (original casing). */
  readonly word: string;
  /** Suggested replacements, cased to match `word`. May be empty (flag-only). */
  readonly suggestions: readonly string[];
}

interface WordToken {
  readonly word: string;
  readonly start: number;
  readonly end: number;
}

// A run of letters/marks with optional interior apostrophes. Cooklang syntax
// (@ # ~ { } %), digits and whitespace all act as separators, so units like
// "200g" contribute only "g" and never the numeric part.
const RUN_RE = /\p{L}[\p{L}\p{M}'’]*/gu;

// Empty string (used for out-of-range neighbours) reports as neither upper nor
// lower, so callers can treat missing characters as uncased without a guard.
function isUpper(char: string): boolean {
  return char.toUpperCase() === char && char.toLowerCase() !== char;
}

function isLower(char: string): boolean {
  return char.toLowerCase() === char && char.toUpperCase() !== char;
}

/**
 * Splits a raw letter run into camelCase / PascalCase sub-words, mirroring how
 * `typos` tokenises identifiers, while tracking absolute offsets. Uncased
 * scripts (no upper/lower distinction) stay a single token.
 */
function splitIdentifier(run: string, offset: number): WordToken[] {
  const tokens: WordToken[] = [];
  let start = 0;
  const push = (from: number, to: number) => {
    if (to > from) {
      tokens.push({
        word: run.slice(from, to),
        start: offset + from,
        end: offset + to,
      });
    }
  };
  for (let i = 1; i < run.length; i++) {
    const prev = run[i - 1] ?? "";
    const cur = run[i] ?? "";
    const next = run[i + 1] ?? "";
    const lowerToUpper = isLower(prev) && isUpper(cur);
    const acronymEnd = isUpper(prev) && isUpper(cur) && isLower(next);
    if (lowerToUpper || acronymEnd) {
      push(start, i);
      start = i;
    }
  }
  push(start, run.length);
  return tokens;
}

/** Tokenises text into offset-tracked words, skipping non-letter separators. */
export function tokenizeWords(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  for (const match of text.matchAll(RUN_RE)) {
    // Trim trailing apostrophes so "don't" keeps its interior mark but a run
    // like "fish'" does not carry the trailing quote into the lookup.
    let run = match[0];
    let start = match.index;
    while (run.length > 0 && (run.endsWith("'") || run.endsWith("’"))) {
      run = run.slice(0, -1);
    }
    while (run.length > 0 && (run.startsWith("'") || run.startsWith("’"))) {
      run = run.slice(1);
      start += 1;
    }
    if (!run) continue;
    tokens.push(...splitIdentifier(run, start));
  }
  return tokens;
}

function isAllUpper(word: string): boolean {
  return (
    word.length > 1 &&
    word === word.toUpperCase() &&
    word !== word.toLowerCase()
  );
}

function isTitleCase(word: string): boolean {
  return (
    isUpper(word[0] ?? "") && word.slice(1) === word.slice(1).toLowerCase()
  );
}

function matchCase(word: string, suggestion: string): string {
  if (isAllUpper(word)) return suggestion.toUpperCase();
  if (isTitleCase(word)) {
    return suggestion.charAt(0).toUpperCase() + suggestion.slice(1);
  }
  return suggestion;
}

/**
 * Finds known misspellings in `text`. `dictionary` maps a lowercased typo to its
 * lowercased corrections; `ignored` holds lowercased words the author dismissed.
 */
export function findMisspellings(
  text: string,
  dictionary: ReadonlyMap<string, readonly string[]>,
  ignored?: ReadonlySet<string>,
): Misspelling[] {
  const results: Misspelling[] = [];
  for (const token of tokenizeWords(text)) {
    const key = token.word.toLowerCase();
    if (ignored?.has(key)) continue;
    const corrections = dictionary.get(key);
    if (!corrections) continue;
    const suggestions = [
      ...new Set(
        corrections.map((correction) => matchCase(token.word, correction)),
      ),
    ];
    results.push({
      start: token.start,
      end: token.end,
      word: token.word,
      suggestions,
    });
  }
  return results;
}

/** Replaces the flagged range with `replacement`, returning the new text. */
export function applyCorrection(
  text: string,
  misspelling: Pick<Misspelling, "start" | "end">,
  replacement: string,
): string {
  return (
    text.slice(0, misspelling.start) + replacement + text.slice(misspelling.end)
  );
}
