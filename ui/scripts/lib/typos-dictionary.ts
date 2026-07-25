/**
 * Pure helpers for turning the `typos` project's `words.csv` correction
 * dictionary into the compact TSV asset the recipe editor loads at runtime.
 *
 * Kept free of I/O so the parsing logic can be unit-tested without the network.
 */

/** Extracts the pinned typos version (e.g. `1.48.0`) from a `.mise.toml`. */
export function parseTyposVersion(miseToml: string): string {
  const version = miseToml.match(/^\s*typos\s*=\s*"([^"]+)"/m)?.[1];
  if (!version) {
    throw new Error('Could not find a pinned `typos = "…"` version in .mise.toml');
  }
  return version;
}

/**
 * Parses the raw `words.csv` (one `typo,correction[,correction2…]` per line)
 * into a map of lowercased typo → corrections. Blank corrections are dropped so
 * a trailing comma does not produce an empty suggestion.
 */
export function parseWordsCsv(csv: string): Map<string, string[]> {
  const dict = new Map<string, string[]>();
  for (const rawLine of csv.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const cells = line.split(",");
    const typo = cells[0]?.trim().toLowerCase();
    if (!typo) continue;
    const corrections = cells
      .slice(1)
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);
    dict.set(typo, corrections);
  }
  return dict;
}

/**
 * Parses the `[default.extend-words]` block of a `_typos.toml` into a map of
 * lowercased key → value. Comments and other sections are ignored.
 */
export function parseExtendWords(typosToml: string): Map<string, string> {
  const overrides = new Map<string, string>();
  const lines = typosToml.split("\n");
  let inSection = false;
  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    if (line.startsWith("[")) {
      inSection = line === "[default.extend-words]";
      continue;
    }
    if (!inSection) continue;
    const match = line.match(/^"?([^"=]+?)"?\s*=\s*"([^"]*)"/);
    const key = match?.[1];
    const value = match?.[2];
    if (key !== undefined && value !== undefined) {
      overrides.set(key.trim().toLowerCase(), value.trim());
    }
  }
  return overrides;
}

/**
 * Applies `_typos.toml` extend-words on top of the base dictionary. A key that
 * maps to itself is an allowlist entry (drop it so the editor never flags it); a
 * key mapping to a different word is a custom correction override.
 */
export function applyExtendWords(
  dict: Map<string, string[]>,
  overrides: Map<string, string>,
): void {
  for (const [key, value] of overrides) {
    if (value.toLowerCase() === key) {
      dict.delete(key);
    } else {
      dict.set(key, [value]);
    }
  }
}

/**
 * Serialises the dictionary to the TSV asset format: one
 * `typo\tcorrection[,correction2…]` line per entry, sorted for stable diffs.
 * Entries with no correction are kept (flag-only) with an empty value.
 */
export function serializeDictionary(dict: Map<string, string[]>): string {
  const lines: string[] = [];
  for (const typo of [...dict.keys()].sort()) {
    lines.push(`${typo}\t${dict.get(typo)?.join(",") ?? ""}`);
  }
  return `${lines.join("\n")}\n`;
}
