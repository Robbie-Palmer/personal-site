import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { createFinding } from "writing-editor-domain/findings";
import { sha256, sourceReference } from "writing-editor-domain/suggestions";

import {
  buildEditHunks,
  matchFindingToEdits,
  matchPublishedEdits,
} from "../src/match-edits";
import { EditMatchRunSchema } from "../src/schemas";

const temporaryDirectories = new Set<string>();
const SOURCE_REVISION = "a".repeat(40);
const PUBLISHED_REVISION = "b".repeat(40);
const COHORT_ID = `cohort:v1:${"c".repeat(64)}`;
const PRODUCER_RUN_ID = `producer-run:v1:${"d".repeat(64)}`;
const PRODUCER_VERSION = "vale@3.20.0+rules.fixture";

afterEach(() => {
  for (const directory of temporaryDirectories) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  temporaryDirectories.clear();
});

function temporaryDirectory(prefix: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirectories.add(directory);
  return directory;
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function bytePosition(source: string, text: string): { startByte: number; endByte: number } {
  const characterIndex = source.indexOf(text);
  if (characterIndex < 0) throw new Error(`missing fixture text ${text}`);
  const startByte = Buffer.byteLength(source.slice(0, characterIndex), "utf8");
  return { startByte, endByte: startByte + Buffer.byteLength(text, "utf8") };
}

function finding(source: string, text: string) {
  const span = bytePosition(source, text);
  return createFinding({
    producer: {
      id: "vale",
      version: PRODUCER_VERSION,
      provenance: { kind: "rule", ruleId: "Unslop.ContrastFormula" },
    },
    source: sourceReference("docs/example.md", SOURCE_REVISION, source),
    span: { ...span, sourceText: text },
    category: "style/unslop/contrast-formula",
    reason: "State the point directly",
  });
}

function fixture(root: string): {
  cohortFile: string;
  corpusRoot: string;
  findingsFile: string;
  paramsFile: string;
  outputFile: string;
  publishedFile: string;
} {
  const source = "# Draft\n\nAA target BAD text ZZ\nKeep this phrase.\n";
  const published = "# Draft\n\nPREFIX AA target good text ZZ\nKeep this phrase.\n";
  const corpusRoot = path.join(root, "corpus");
  const sourceFile = "artifacts/example/source.md";
  const publishedFile = path.join(corpusRoot, "artifacts/example/published.md");
  fs.mkdirSync(path.dirname(publishedFile), { recursive: true });
  fs.writeFileSync(path.join(corpusRoot, sourceFile), source);
  fs.writeFileSync(publishedFile, published);

  const changed = finding(source, "target BAD");
  const unchanged = finding(source, "Keep this phrase");
  const cohortFile = path.join(root, "cohort.json");
  const findingsFile = path.join(root, "findings.json");
  const paramsFile = path.join(root, "params.json");
  const outputFile = path.join(root, "matched.json");
  writeJson(cohortFile, {
    schemaVersion: 1,
    recordType: "writing-editor-frozen-cohort",
    cohortId: COHORT_ID,
    datasetId: `dataset:v1:${"e".repeat(64)}`,
    frozenAt: "2026-09-09T00:00:00Z",
    seed: "fixture",
    splitRatios: { train: 0.6, validation: 0.2, holdout: 0.2 },
    entries: [{
      artifactId: "example",
      artifactType: "adr",
      path: "docs/example.md",
      outcomeStatus: "unrecorded",
      split: "train",
      source: {
        revision: SOURCE_REVISION,
        committedAt: "2026-09-08T00:00:00Z",
        contentHash: sha256(source),
        bytes: Buffer.byteLength(source),
        file: sourceFile,
      },
      published: {
        revision: PUBLISHED_REVISION,
        committedAt: "2026-09-09T00:00:00Z",
        contentHash: sha256(published),
        bytes: Buffer.byteLength(published),
        file: "artifacts/example/published.md",
      },
    }],
  });
  writeJson(findingsFile, {
    schemaVersion: 1,
    recordType: "writing-editor-vale-producer-run",
    runId: PRODUCER_RUN_ID,
    cohortId: COHORT_ID,
    producer: {
      id: "vale",
      version: PRODUCER_VERSION,
      provenance: { kind: "rule", ruleId: "configured-rule-set" },
    },
    vale: { binaryVersion: "3.20.0", ruleSetHash: `sha256:${"f".repeat(64)}` },
    artifacts: [{
      artifactId: "example",
      artifactType: "adr",
      split: "train",
      source: sourceReference("docs/example.md", SOURCE_REVISION, source),
      findingIds: [changed.findingId, unchanged.findingId],
      findings: [changed, unchanged].map((item, index) => ({
        severity: "error",
        valeMatch: item.span.sourceText,
        location: { line: index + 3, startColumn: 1, endColumn: 10 },
        finding: item,
      })),
    }],
    summary: {
      artifacts: 1,
      artifactsWithFindings: 1,
      findings: 2,
      bySeverity: { error: 2, warning: 0, suggestion: 0 },
      byCheck: [{ check: "Unslop.ContrastFormula", count: 2 }],
    },
  });
  writeJson(paramsFile, {
    cohort: {
      frozenAt: "2026-09-09T00:00:00Z",
      seed: "fixture",
      split: { train: 0.6, validation: 0.2, holdout: 0.2 },
      requiredArtifactTypes: ["adr"],
    },
    producers: { vale: { binaryVersion: "3.20.0" } },
    matching: { characterDiff: { maxEditLength: 1_000 } },
  });
  return { cohortFile, corpusRoot, findingsFile, paramsFile, outputFile, publishedFile };
}

describe("published edit matcher", () => {
  it("creates exact UTF-8 hunk ranges for insertions and replacements", () => {
    const source = "Café has OLD text.";
    const published = "Start: Cafe has new text.";
    const hunks = buildEditHunks(source, published, 100);

    expect(hunks.map(({ source: oldSpan, published: newSpan }) => ({
      source: oldSpan.text,
      published: newSpan.text,
    }))).toEqual([
      { source: "", published: "Start: " },
      { source: "é", published: "e" },
      { source: "OLD", published: "new" },
    ]);
    expect(hunks[1]?.source).toEqual({ startByte: 3, endByte: 5, text: "é" });
    expect(hunks[1]?.published).toEqual({ startByte: 10, endByte: 11, text: "e" });
    expect(hunks.every(({ hunkId }) => /^edit-hunk:v1:[a-f0-9]{64}$/.test(hunkId)))
      .toBe(true);
  });

  it("maps changed and unchanged findings into the published text", () => {
    const source = "AA target BAD text ZZ. Keep this phrase.";
    const published = "PREFIX AA target good text ZZ. Keep this phrase.";
    const hunks = buildEditHunks(source, published, 100);

    const changed = matchFindingToEdits(finding(source, "target BAD"), hunks, published);
    const unchanged = matchFindingToEdits(
      finding(source, "Keep this phrase"),
      hunks,
      published,
    );

    expect(changed).toMatchObject({
      status: "changed",
      reason: null,
      publishedSpan: { text: "target good" },
    });
    expect(changed.hunkIds).toHaveLength(1);
    expect(unchanged).toMatchObject({
      status: "unchanged",
      hunkIds: [],
      reason: null,
      publishedSpan: { text: "Keep this phrase" },
    });
    expect(unchanged.publishedSpan?.startByte).toBeGreaterThan(
      bytePosition(source, "Keep this phrase").startByte,
    );
  });

  it("requires adjudication when an edit crosses a finding boundary", () => {
    const source = "AA target BAD text ZZ";
    const published = "AA target good prose ZZ";
    const hunks = buildEditHunks(source, published, 100);
    const result = matchFindingToEdits(finding(source, "target BAD tex"), hunks, published);

    expect(result).toMatchObject({
      status: "manual-adjudication-required",
      publishedSpan: null,
      reason: "edit-crosses-finding-boundary",
    });
    expect(result.hunkIds.length).toBeGreaterThan(0);
  });

  it("requires adjudication for an insertion on a finding boundary", () => {
    const source = "AA target ZZ";
    const published = "AA target! ZZ";
    const hunks = buildEditHunks(source, published, 100);
    const result = matchFindingToEdits(finding(source, "target"), hunks, published);

    expect(result).toMatchObject({
      status: "manual-adjudication-required",
      publishedSpan: null,
      reason: "edit-touches-finding-boundary",
    });
  });

  it("fails predictably when the configured edit-distance ceiling is exceeded", () => {
    expect(() => buildEditHunks("a".repeat(20), "b".repeat(20), 2))
      .toThrow("character diff exceeded maxEditLength 2");
  });

  it("writes a stable, validated match run without inferring decisions", () => {
    const temporary = temporaryDirectory("writing-match-");
    const options = fixture(temporary);
    const result = matchPublishedEdits(options);

    expect(result.summary).toEqual({
      artifacts: 1,
      findings: 2,
      editHunks: 2,
      byStatus: {
        changed: 1,
        unchanged: 1,
        "manual-adjudication-required": 0,
      },
    });
    expect(result).not.toHaveProperty("decisions");
    expect(result.artifacts[0]?.matches[0]?.publishedSpan?.text).toBe("target good");
    expect(EditMatchRunSchema.parse(
      JSON.parse(fs.readFileSync(options.outputFile, "utf8")),
    )).toEqual(result);

    const repeated = matchPublishedEdits({
      ...options,
      outputFile: path.join(temporary, "repeated.json"),
    });
    expect(repeated).toEqual(result);
  });

  it("rejects stale published content and a producer from another cohort", () => {
    const staleTemporary = temporaryDirectory("writing-match-stale-");
    const stale = fixture(staleTemporary);
    fs.appendFileSync(stale.publishedFile, "stale");
    expect(() => matchPublishedEdits(stale)).toThrow(/published contentHash mismatch/);
    expect(fs.existsSync(stale.outputFile)).toBe(false);

    const cohortTemporary = temporaryDirectory("writing-match-cohort-");
    const mismatched = fixture(cohortTemporary);
    const producer = JSON.parse(fs.readFileSync(mismatched.findingsFile, "utf8"));
    producer.cohortId = `cohort:v1:${"9".repeat(64)}`;
    writeJson(mismatched.findingsFile, producer);
    expect(() => matchPublishedEdits(mismatched)).toThrow(/producer cohort mismatch/);
  });
});
