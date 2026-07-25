#!/usr/bin/env tsx

/**
 * Generates ui/public/recipes/typos-dictionary.tsv from the `typos` project's
 * curated correction dictionary, so the recipe editor's inline spell-checker
 * flags exactly what the pre-commit / CI `typos` gate does.
 *
 * The typos version is read from .mise.toml so the dictionary can never drift
 * from the tool. The repo-root _typos.toml allowlist/overrides are applied on
 * top. The output is NOT committed — it is generated into `public/` for `dev`
 * and, post-`next build`, straight into `out/` for the export (see
 * ui/package.json). `--out <dir>` overrides the target directory; writing the
 * build copy into `out/` (not `public/`) keeps it out of the mise build task's
 * cached `sources`. A stamp of the typos version plus the _typos.toml overrides
 * lets repeat runs skip the network once that exact input has been built, and
 * refetches when either changes; pass FORCE=1 to refetch unconditionally.
 */

import crypto from "node:crypto";
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
const outFlag = process.argv.indexOf("--out");
const OUT_DIR =
  outFlag !== -1 && process.argv[outFlag + 1]
    ? path.resolve(process.cwd(), process.argv[outFlag + 1] as string)
    : path.join(process.cwd(), "public", "recipes");
const OUTPUT = path.join(OUT_DIR, "typos-dictionary.tsv");
// Records the exact inputs (typos version + _typos.toml overrides) that produced
// OUTPUT so a stale local copy is refetched when either changes, not reused
// forever.
const STAMP = `${OUTPUT}.version`;

async function main(): Promise<void> {
  const miseToml = fs.readFileSync(path.join(REPO_ROOT, ".mise.toml"), "utf8");
  const version = parseTyposVersion(miseToml);
  const typosToml = fs.readFileSync(path.join(REPO_ROOT, "_typos.toml"), "utf8");
  const overrides = parseExtendWords(typosToml);
  const overridesHash = crypto
    .createHash("sha256")
    .update(
      [...overrides]
        .map(([key, value]) => `${key}=${value}`)
        .sort((a, b) => a.localeCompare(b))
        .join("\n"),
    )
    .digest("hex")
    .slice(0, 12);
  const stamp = `${version}:${overridesHash}`;

  const current =
    fs.existsSync(OUTPUT) && fs.existsSync(STAMP)
      ? fs.readFileSync(STAMP, "utf8").trim()
      : null;
  if (current === stamp && !process.env.FORCE) {
    console.log(`typos v${version} dictionary already present; skipping fetch.`);
    return;
  }

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
  applyExtendWords(dict, overrides);

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, serializeDictionary(dict));
  fs.writeFileSync(STAMP, `${stamp}\n`);
  console.log(
    `Wrote ${dict.size.toLocaleString()} corrections to ${path.relative(process.cwd(), OUTPUT)}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
