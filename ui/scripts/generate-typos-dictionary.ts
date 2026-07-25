#!/usr/bin/env tsx

/**
 * Generates ui/public/recipes/typos-dictionary.tsv from the `typos` project's
 * curated correction dictionary, so the recipe editor's inline spell-checker
 * flags exactly what the pre-commit / CI `typos` gate does.
 *
 * The typos version is read from .mise.toml so the dictionary can never silently
 * drift from the tool. The repo-root _typos.toml allowlist/overrides are applied
 * on top. The output is committed; re-run only when bumping the typos version:
 *
 *   mise run //ui:generate:typos-dictionary
 */

import fs from "node:fs";
import path from "node:path";
import {
  applyExtendWords,
  parseExtendWords,
  parseTyposVersion,
  parseWordsCsv,
  serializeDictionary,
} from "./lib/typos-dictionary";

const REPO_ROOT = path.resolve(process.cwd(), "..");
const OUTPUT = path.join(
  process.cwd(),
  "public",
  "recipes",
  "typos-dictionary.tsv",
);

async function main(): Promise<void> {
  const miseToml = fs.readFileSync(path.join(REPO_ROOT, ".mise.toml"), "utf8");
  const version = parseTyposVersion(miseToml);
  const csvUrl = `https://raw.githubusercontent.com/crate-ci/typos/v${version}/crates/typos-dict/assets/words.csv`;

  console.log(`Fetching typos v${version} dictionary: ${csvUrl}`);
  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch words.csv (${response.status} ${response.statusText}) from ${csvUrl}`,
    );
  }
  const csv = await response.text();

  const dict = parseWordsCsv(csv);
  const typosToml = fs.readFileSync(path.join(REPO_ROOT, "_typos.toml"), "utf8");
  applyExtendWords(dict, parseExtendWords(typosToml));

  const tsv = serializeDictionary(dict);
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, tsv);
  console.log(
    `Wrote ${dict.size.toLocaleString()} corrections to ${path.relative(process.cwd(), OUTPUT)}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
