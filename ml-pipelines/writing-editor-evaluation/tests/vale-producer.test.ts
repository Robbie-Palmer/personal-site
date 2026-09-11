import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { sha256 } from "writing-editor-domain/suggestions";

import { runValeProducer, valeAlertToFinding } from "../src/run-vale";
import { ValeProducerRunSchema } from "../src/schemas";

const temporaryDirectories = new Set<string>();
const repositoryRoot = path.resolve(import.meta.dirname, "../../..");

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

function fixture(temporary: string): {
  cohortFile: string;
  corpusRoot: string;
  paramsFile: string;
  outputFile: string;
} {
  const corpusRoot = path.join(temporary, "corpus");
  const sourceFile = "artifacts/example/source.md";
  const source = "# Draft\n\nCafé is evidence, not merely polish.\n";
  fs.mkdirSync(path.join(corpusRoot, "artifacts/example"), { recursive: true });
  fs.writeFileSync(path.join(corpusRoot, sourceFile), source);
  const contentHash = sha256(source);

  const cohortFile = path.join(temporary, "cohort.json");
  const paramsFile = path.join(temporary, "params.json");
  const outputFile = path.join(temporary, "vale.json");
  writeJson(cohortFile, {
    schemaVersion: 1,
    recordType: "writing-editor-frozen-cohort",
    cohortId: `cohort:v1:${"a".repeat(64)}`,
    datasetId: `dataset:v1:${"b".repeat(64)}`,
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
        revision: "a".repeat(40),
        committedAt: "2026-09-08T00:00:00Z",
        contentHash,
        bytes: Buffer.byteLength(source),
        file: sourceFile,
      },
      published: {
        revision: "b".repeat(40),
        committedAt: "2026-09-09T00:00:00Z",
        contentHash: `sha256:${"c".repeat(64)}`,
        bytes: 1,
        file: "artifacts/example/published.md",
      },
    }],
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
  return { cohortFile, corpusRoot, paramsFile, outputFile };
}

describe("Vale producer", () => {
  it("converts inclusive character columns to exact UTF-8 byte spans", () => {
    const source = "# Draft\n\nCafé is evidence, not merely polish.\n";
    const record = valeAlertToFinding(
      source,
      "docs/example.md",
      "a".repeat(40),
      "vale@3.20.0+rules.fixture",
      {
        Span: [6, 21],
        Check: "Unslop.ContrastFormula",
        Message: "State the point directly",
        Severity: "error",
        Match: "is evidence, not",
        Line: 3,
      },
    );

    expect(record.finding.span).toEqual({
      startByte: Buffer.byteLength("# Draft\n\nCafé "),
      endByte: Buffer.byteLength("# Draft\n\nCafé is evidence, not"),
      sourceText: "is evidence, not",
    });
    expect(record.finding.category).toBe("style/unslop/contrast-formula");
    expect(record.finding).not.toHaveProperty("replacement");
  });

  it("rejects a Vale span outside the reported source line", () => {
    expect(() => valeAlertToFinding(
      "Direct prose.\n",
      "docs/example.md",
      "a".repeat(40),
      "vale@3.20.0+rules.fixture",
      {
        Span: [1, 30],
        Check: "Unslop.Example",
        Message: "Example",
        Severity: "error",
        Match: "Wrong!",
        Line: 1,
      },
    )).toThrow(/outside the source line/);
  });

  it("keeps source markup when Vale reports a normalized match", () => {
    const source = "Cooklang is the **content format**, not the interface.\n";
    const record = valeAlertToFinding(
      source,
      "docs/example.md",
      "a".repeat(40),
      "vale@3.20.0+rules.fixture",
      {
        Span: [10, 39],
        Check: "Unslop.ContrastFormula",
        Message: "State the point directly",
        Severity: "error",
        Match: "is the content format, not",
        Line: 1,
      },
    );

    expect(record.valeMatch).toBe("is the content format, not");
    expect(record.finding.span.sourceText).toBe("is the **content format**, not");
  });

  it("runs the pinned Vale binary and writes validated producer output", () => {
    const temporary = temporaryDirectory("writing-vale-");
    const options = fixture(temporary);

    const result = runValeProducer({
      ...options,
      configFile: path.join(repositoryRoot, ".vale.ini"),
      stylesDirectory: path.join(repositoryRoot, ".vale/styles/Unslop"),
      valeBinary: "vale",
    });

    expect(result.summary).toMatchObject({
      artifacts: 1,
      artifactsWithFindings: 1,
      findings: 1,
      bySeverity: { error: 1, warning: 0, suggestion: 0 },
    });
    expect(result.artifacts[0]?.findings[0]?.finding.span.sourceText)
      .toBe("is evidence, not merely");
    expect(ValeProducerRunSchema.parse(
      JSON.parse(fs.readFileSync(options.outputFile, "utf8")),
    )).toEqual(result);
  });

  it("stops when the installed Vale version differs from the pinned version", () => {
    const temporary = temporaryDirectory("writing-vale-version-");
    const options = fixture(temporary);
    const params = JSON.parse(fs.readFileSync(options.paramsFile, "utf8"));
    params.producers.vale.binaryVersion = "9.9.9";
    writeJson(options.paramsFile, params);

    expect(() => runValeProducer({
      ...options,
      configFile: path.join(repositoryRoot, ".vale.ini"),
      stylesDirectory: path.join(repositoryRoot, ".vale/styles/Unslop"),
      valeBinary: "vale",
    })).toThrow("Vale version mismatch: expected 9.9.9, got 3.20.0");
    expect(fs.existsSync(options.outputFile)).toBe(false);
  });
});
