/**
 * prose-lint.ts — deterministic prose linter wrapper around Vale.
 *
 * Reads Vale JSON output and filters to only the lines changed in the
 * working tree (or, with --staged, the index).  This lets us add strict
 * rules incrementally without flooding the developer with pre-existing
 * issues.
 *
 * Usage:
 *   mise run //:lint:prose -- [files...]
 *   mise run //:lint:prose:staged           # staged changes only
 *   mise run //:lint:prose:check            # full repo, fail on any alert
 *
 * Exit codes:
 *   0 — no blocking issues on changed lines
 *   1 — blocking issues found (or vale itself failed)
 *   2 — only advisory issues on changed lines (non-zero for CI when
 *       --strict is passed, otherwise still exits 0)
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const VALE_BIN = process.env.VALE_BIN || "vale";
const VALE_CONFIG = resolve(import.meta.dirname, "..", ".vale.ini");

/* ------------------------------------------------------------------ */
/*  Help                                                              */
/* ------------------------------------------------------------------ */

function printHelp(): never {
  console.log(`
Usage: prose-lint.ts [options] [files...]

Options:
  --staged       Compare against the git index (cached diff).
                 Implies --base=HEAD --diff=cached.
  --base <ref>   Git base ref to diff against (default: HEAD).
                 Ignored when --staged is set.
  --diff <type>  Diff type: "cached" (staged), "working" (unstaged),
                 or "auto" (default: "auto").  Auto picks working for
                 tracked files, full scan for untracked.
  --all          Treat every line of every file as changed (whole-file
                 scan; used by lint:prose:check).
  --strict       Fail on warnings/advisories too (exit 1).
  --help         Print this help and exit.

Exit codes:
  0 — no blocking issues on changed lines
  1 — blocking issues found (or vale itself failed)
  2 — only advisory issues on changed lines (non-zero with --strict)

When lint-staged triggers this script it passes the staged file paths
without flags.  Run with --staged (via lint:prose:staged) so pre-commit
enforcement inspects the index rather than the working tree.

Environment:
  VALE_BIN  Override the vale binary path.
`);
  process.exit(0);
}

/* ------------------------------------------------------------------ */
/*  Git helpers                                                        */
/* ------------------------------------------------------------------ */

function changedLines(
  file: string,
  ref: string,
  cached: boolean,
): Set<number> | null {
  const args = cached
    ? ["diff", "--cached", "--unified=0", ref, "--", file]
    : ["diff", "--unified=0", ref, "--", file];

  let stdout: string;
  try {
    stdout = execFileSync("git", args, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e: unknown) {
    const err = e as { stderr?: string };
    if (err.stderr) console.error(err.stderr.trimEnd());
    console.error(`prose-lint: git ${args.join(" ")} failed`);
    process.exit(1);
  }

  if (!stdout) return null;

  const lines = new Set<number>();
  const hunkRe = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm;
  let m: RegExpExecArray | null;
  while ((m = hunkRe.exec(stdout)) !== null) {
    const start = Number(m[1]);
    const count = m[2] ? Number(m[2]) : 1;
    for (let i = 0; i < count; i++) lines.add(start + i);
  }
  return lines.size > 0 ? lines : null;
}

function allLines(file: string): Set<number> {
  try {
    const content = readFileSync(file, "utf-8");
    const lineCount = content.split("\n").length;
    return new Set(Array.from({ length: lineCount }, (_, i) => i + 1));
  } catch {
    return new Set();
  }
}

function isTracked(file: string): boolean {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", file], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch (e: unknown) {
    const err = e as { status?: number; stderr?: string };
    if (err.status === 1) return false;
    if (err.stderr) console.error(err.stderr.trimEnd());
    console.error(`prose-lint: git ls-files failed for ${file}`);
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ */
/*  Vale runner                                                        */
/* ------------------------------------------------------------------ */

interface ValeAlert {
  Check: string;
  File: string;
  Line: number;
  Message: string;
  Severity: "error" | "warning" | "suggestion";
}

const SEVERITY_LABEL: Record<ValeAlert["Severity"], string> = {
  error: "BLOCK",
  warning: "WARN",
  suggestion: "SUGGEST",
};

interface ValeOutput {
  [file: string]: ValeAlert[];
}

function runVale(files: string[]): ValeAlert[] {
  const args = ["--config", VALE_CONFIG, "--output", "JSON", ...files];

  let stdout: string;
  let failed = false;
  let failure = "";
  let failureStatus = 1;
  try {
    stdout = execFileSync(VALE_BIN, args, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (e: unknown) {
    const err = e as {
      stdout?: string;
      stderr?: string;
      status?: number;
      message?: string;
    };
    failed = true;
    failureStatus = err.status ?? 1;
    stdout = err.stdout || "";
    if (err.stderr) {
      failure = err.stderr.trimEnd();
    } else if (!stdout) {
      failure = `vale failed: ${String(err.message || "unknown error")}`;
    }
  }

  if (failed && !stdout) {
    // Spawn/config failure produces no JSON — surface it clearly.
    console.error(failure || "prose-lint: vale failed to run");
    process.exit(failureStatus);
  }
  if (failure) console.error(failure);

  try {
    const parsed: ValeOutput = JSON.parse(stdout);
    const alerts: ValeAlert[] = [];
    for (const file of Object.keys(parsed)) {
      // Vale keys each alert by the file path; inject it so filtering and
      // reporting can reference the file.
      for (const alert of parsed[file]) {
        alert.File = file;
        alerts.push(alert);
      }
    }
    return alerts;
  } catch {
    console.error("prose-lint: failed to parse Vale JSON output");
    console.error(stdout);
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

interface ProseOptions {
  files: string[];
  staged: boolean;
  strict: boolean;
  all: boolean;
  explicitDiff: "cached" | "working" | "auto" | null;
  base: string;
}

function parseArgs(argv: string[]): ProseOptions {
  const opts: ProseOptions = {
    files: [],
    staged: false,
    strict: false,
    all: false,
    explicitDiff: null,
    base: "HEAD",
  };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--staged":
        opts.staged = true;
        break;
      case "--strict":
        opts.strict = true;
        break;
      case "--all":
        opts.all = true;
        break;
      case "--base":
        if (++i >= argv.length || argv[i].startsWith("--")) {
          console.error("prose-lint: --base requires a value");
          process.exit(1);
        }
        opts.base = argv[i];
        break;
      case "--diff": {
        if (++i >= argv.length || argv[i].startsWith("--")) {
          console.error("prose-lint: --diff requires a value");
          process.exit(1);
        }
        const value = argv[i];
        if (value !== "cached" && value !== "working" && value !== "auto") {
          console.error(`prose-lint: unknown diff type ${value}`);
          process.exit(1);
        }
        opts.explicitDiff = value;
        break;
      }
      default:
        if (argv[i].startsWith("--")) {
          console.error(`prose-lint: unknown flag ${argv[i]}`);
          process.exit(1);
        }
        opts.files.push(argv[i]);
    }
  }
  return opts;
}

function isValeStylePath(file: string): boolean {
  const norm = file.replaceAll("\\", "/");
  return (
    norm.startsWith("./.vale/") ||
    norm.startsWith(".vale/") ||
    norm.includes("/.vale/")
  );
}

function contentFilesOnly(files: string[]): string[] {
  return files.filter((f) => !isValeStylePath(f));
}

function changedLinesFor(
  file: string,
  base: string,
  mode: "cached" | "working" | "auto",
): Set<number> | null {
  if (mode === "cached") return changedLines(file, base, true);
  if (mode === "working") return changedLines(file, base, false);

  let lines = changedLines(file, base, false);
  lines ??= changedLines(file, base, true);
  // Untracked files have no base content to diff against, so scan the
  // whole file.  Tracked-but-unchanged files yield no set and are
  // skipped entirely, keeping enforcement deterministic to the diff.
  if (lines === null && !isTracked(file)) lines = allLines(file);
  return lines;
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help")) printHelp();

  const opts = parseArgs(args);
  if (opts.files.length === 0) {
    console.error("prose-lint: no files specified");
    process.exit(1);
  }

  // Vendored Vale styles under .vale/ are style definitions, not site
  // content — never lint them against their own rules.
  const contentFiles = contentFilesOnly(opts.files);
  if (contentFiles.length === 0) process.exit(0);

  // Files staged as deletions no longer exist on disk; Vale can't lint
  // them, and their removal needs no prose review.
  const existingFiles = contentFiles.filter((f) => existsSync(f));
  if (existingFiles.length === 0) process.exit(0);

  const diffMode = opts.staged ? "cached" : opts.explicitDiff || "auto";

  const changedMap = new Map<string, Set<number> | null>();
  for (const f of existingFiles) {
    const lines = opts.all
      ? allLines(f)
      : changedLinesFor(f, opts.base, diffMode);
    changedMap.set(resolve(f), lines);
  }

  const filtered = runVale(existingFiles).filter((alert) => {
    const changed = changedMap.get(resolve(alert.File));
    return changed ? changed.has(alert.Line) : false;
  });

  let hasBlockers = false;
  let hasAdvisories = false;

  for (const alert of filtered) {
    console.log(
      `${SEVERITY_LABEL[alert.Severity]}  ${alert.File}:${alert.Line}  ${alert.Message}  [${alert.Check}]`,
    );
    if (alert.Severity === "error") hasBlockers = true;
    if (alert.Severity !== "error") hasAdvisories = true;
  }

  if (hasBlockers) process.exit(1);
  if (opts.strict && hasAdvisories) process.exit(2);
  process.exit(0);
}

main();
