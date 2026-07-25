/**
 * Lazily loads the curated typo-correction dictionary used by the recipe
 * editor's inline spell-checker. The asset is generated from the pinned `typos`
 * version (ui/scripts/generate-typos-dictionary.ts) and served statically, so it
 * is fetched at most once per session and memoised — mirroring the WASM parser
 * loader in hooks/use-cooklang-recipe.ts.
 */

export const TYPO_DICTIONARY_URL = "/recipes/typos-dictionary.tsv";

/** Parses the `typo\tcorrection[,correction2…]` TSV asset into a lookup map. */
export function parseDictionaryTsv(text: string): Map<string, string[]> {
  const dictionary = new Map<string, string[]>();
  for (const line of text.split("\n")) {
    if (!line) continue;
    const tab = line.indexOf("\t");
    const typo = tab === -1 ? line : line.slice(0, tab);
    if (!typo) continue;
    const rest = tab === -1 ? "" : line.slice(tab + 1);
    dictionary.set(typo, rest ? rest.split(",") : []);
  }
  return dictionary;
}

let cache: Promise<Map<string, string[]>> | null = null;

/**
 * Fetches and caches the dictionary. Injectable `fetchImpl` keeps it testable;
 * a failed load clears the cache so a later attempt can retry.
 */
export function loadTypoDictionary(
  fetchImpl: typeof fetch = fetch,
): Promise<Map<string, string[]>> {
  if (cache) return cache;
  cache = (async () => {
    const response = await fetchImpl(TYPO_DICTIONARY_URL);
    if (!response.ok) {
      throw new Error(
        `Failed to load spell-check dictionary (${response.status})`,
      );
    }
    return parseDictionaryTsv(await response.text());
  })().catch((error: unknown) => {
    cache = null;
    throw error;
  });
  return cache;
}

/** Test-only: resets the module-level cache between cases. */
export function resetTypoDictionaryCache(): void {
  cache = null;
}
