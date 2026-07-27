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
  // Assign synchronously before the first await so concurrent callers share one
  // in-flight request, and on failure only clear the cache if it still points at
  // this attempt (a later retry may have already replaced it).
  const pending = (async () => {
    // Bound the request so the editor never hangs on "Checking spelling…" if
    // the asset stalls; on timeout the load rejects and the hook offers a retry.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetchImpl(TYPO_DICTIONARY_URL, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(
          `Failed to load spell-check dictionary (${response.status})`,
        );
      }
      return parseDictionaryTsv(await response.text());
    } finally {
      clearTimeout(timeout);
    }
  })().catch((error: unknown) => {
    if (cache === pending) cache = null;
    throw error;
  });
  cache = pending;
  return cache;
}

/** Clears the memoised dictionary so the next load refetches (retry / tests). */
export function resetTypoDictionaryCache(): void {
  cache = null;
}
