import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { canonicalJson } from "writing-editor-domain/canonical-json";
import {
  compareFindings,
  createFinding,
  verifyFindingSource,
} from "writing-editor-domain/findings";
import {
  ProducerSchema,
  sha256,
  sourceReference,
} from "writing-editor-domain/suggestions";
import { z } from "zod";

import { readJson, writeJson } from "./files";
import {
  FrozenCohortSchema,
  PipelineParamsSchema,
  type ValeFindingRecord,
  ValeProducerRunSchema,
  type ValeProducerRun,
  ValeSeveritySchema,
} from "./schemas";

const ValeCliOptionsSchema = z.object({
  cohort: z.string().trim().min(1),
  corpus: z.string().trim().min(1),
  params: z.string().trim().min(1),
  config: z.string().trim().min(1),
  styles: z.string().trim().min(1),
  output: z.string().trim().min(1),
  vale: z.string().trim().min(1).default("vale"),
}).strict();

const ValeAlertSchema = z.object({
  Span: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  Check: z.string().trim().min(1),
  Message: z.string().trim().min(1),
  Severity: ValeSeveritySchema,
  Match: z.string().min(1),
  Line: z.number().int().positive(),
}).passthrough().superRefine((alert, context) => {
  if (alert.Span[1] < alert.Span[0]) {
    context.addIssue({
      code: "custom",
      message: "Vale span end must be greater than or equal to its start",
      path: ["Span", 1],
    });
  }
  if (alert.Match.includes("\n") || alert.Match.includes("\r")) {
    context.addIssue({
      code: "custom",
      message: "multiline Vale matches are not supported",
      path: ["Match"],
    });
  }
});
type ValeAlert = z.infer<typeof ValeAlertSchema>;

const ValeJsonSchema = z.record(z.string(), z.array(ValeAlertSchema));

export interface RunValeOptions {
  cohortFile: string;
  corpusRoot: string;
  paramsFile: string;
  configFile: string;
  stylesDirectory: string;
  outputFile: string;
  valeBinary: string;
}

interface SourcePosition {
  startByte: number;
  endByte: number;
  sourceText: string;
}

function compareAscending(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sourcePosition(source: string, alert: ValeAlert): SourcePosition {
  const lines = source.split("\n");
  const line = lines[alert.Line - 1];
  if (line === undefined) {
    throw new Error(`Vale reported missing line ${alert.Line}`);
  }

  const characters = Array.from(line);
  const startCharacter = alert.Span[0] - 1;
  const endCharacter = alert.Span[1];
  if (startCharacter >= characters.length || endCharacter > characters.length) {
    throw new Error(
      `Vale span ${alert.Line}:${alert.Span[0]}-${alert.Span[1]} is outside the source line`,
    );
  }
  const matched = characters.slice(startCharacter, endCharacter).join("");

  const priorLines = lines.slice(0, alert.Line - 1).join("\n");
  const lineStart = alert.Line === 1 ? "" : `${priorLines}\n`;
  const prefix = characters.slice(0, startCharacter).join("");
  const startByte = Buffer.byteLength(lineStart + prefix, "utf8");
  return {
    startByte,
    endByte: startByte + Buffer.byteLength(matched, "utf8"),
    sourceText: matched,
  };
}

function category(check: string): string {
  return `style/${check.split(".").map((part) => part
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()).join("/")}`;
}

export function valeAlertToFinding(
  source: string,
  documentId: string,
  revision: string,
  producerVersion: string,
  alertInput: unknown,
): ValeFindingRecord {
  const alert = ValeAlertSchema.parse(alertInput);
  const finding = createFinding({
    producer: {
      id: "vale",
      version: producerVersion,
      provenance: { kind: "rule", ruleId: alert.Check },
    },
    source: sourceReference(documentId, revision, source),
    span: sourcePosition(source, alert),
    category: category(alert.Check),
    reason: alert.Message,
  });
  const verification = verifyFindingSource(finding, source);
  if (!verification.ok) {
    throw new Error(
      `created invalid Vale finding ${finding.findingId}: ${JSON.stringify(verification.conflicts)}`,
    );
  }
  return {
    severity: alert.Severity,
    valeMatch: alert.Match,
    location: {
      line: alert.Line,
      startColumn: alert.Span[0],
      endColumn: alert.Span[1],
    },
    finding,
  };
}

function filesRecursively(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Vale style path must not be a symbolic link: ${file}`);
      }
      if (entry.isDirectory()) return filesRecursively(file);
      return entry.isFile() && /[.]ya?ml$/i.test(entry.name) ? [file] : [];
    })
    .sort(compareAscending);
}

function ruleSetHash(configFile: string, stylesDirectory: string): string {
  const root = path.dirname(path.resolve(configFile));
  const files = [path.resolve(configFile), ...filesRecursively(path.resolve(stylesDirectory))];
  return sha256(canonicalJson(files.map((file) => ({
    path: path.relative(root, file).replaceAll(path.sep, "/"),
    contentHash: sha256(fs.readFileSync(file)),
  }))));
}

function valeVersion(binary: string): string {
  const output = execFileSync(binary, ["--version"], { encoding: "utf8" }).trim();
  const match = /^vale version (\d+\.\d+\.\d+)$/.exec(output);
  if (!match?.[1]) {
    throw new Error(`cannot parse Vale version from ${JSON.stringify(output)}`);
  }
  return match[1];
}

function runVale(binary: string, configFile: string, files: string[]): Map<string, ValeAlert[]> {
  const alertsByFile = new Map<string, ValeAlert[]>();
  for (const file of files) alertsByFile.set(path.resolve(file), []);

  let stdout = "";
  try {
    stdout = execFileSync(
      binary,
      ["--no-global", "--config", path.resolve(configFile), "--output", "JSON", ...files],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 20 * 1024 * 1024,
      },
    );
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; status?: number };
    stdout = failure.stdout ?? "";
    if (!stdout) {
      throw new Error(
        `Vale failed with status ${failure.status ?? "unknown"}: ${(failure.stderr ?? "").trim()}`,
      );
    }
  }

  const parsed = ValeJsonSchema.parse(JSON.parse(stdout || "{}"));
  for (const [reportedFile, alerts] of Object.entries(parsed)) {
    const resolved = path.resolve(reportedFile);
    if (!alertsByFile.has(resolved)) {
      throw new Error(`Vale reported an unexpected file: ${reportedFile}`);
    }
    alertsByFile.set(resolved, alerts);
  }
  return alertsByFile;
}

function producerVersion(binaryVersion: string, rulesHash: string): string {
  return `vale@${binaryVersion}+rules.${rulesHash.slice("sha256:".length)}`;
}

function compareFindingRecords(left: ValeFindingRecord, right: ValeFindingRecord): number {
  return compareFindings(left.finding, right.finding) ||
    compareAscending(left.severity, right.severity);
}

function summary(artifacts: ValeProducerRun["artifacts"]): ValeProducerRun["summary"] {
  const findings = artifacts.flatMap((artifact) => artifact.findings);
  const bySeverity = { error: 0, warning: 0, suggestion: 0 };
  const checks = new Map<string, number>();
  for (const record of findings) {
    bySeverity[record.severity] += 1;
    const provenance = record.finding.producer.provenance;
    if (provenance.kind !== "rule") throw new Error("Vale finding has non-rule provenance");
    checks.set(provenance.ruleId, (checks.get(provenance.ruleId) ?? 0) + 1);
  }
  return {
    artifacts: artifacts.length,
    artifactsWithFindings: artifacts.filter(({ findings }) => findings.length > 0).length,
    findings: findings.length,
    bySeverity,
    byCheck: [...checks.entries()]
      .sort(([left], [right]) => compareAscending(left, right))
      .map(([check, count]) => ({ check, count })),
  };
}

export function runValeProducer(options: RunValeOptions): ValeProducerRun {
  const cohort = FrozenCohortSchema.parse(readJson(options.cohortFile));
  const params = PipelineParamsSchema.parse(readJson(options.paramsFile));
  const binaryVersion = valeVersion(options.valeBinary);
  if (binaryVersion !== params.producers.vale.binaryVersion) {
    throw new Error(
      `Vale version mismatch: expected ${params.producers.vale.binaryVersion}, got ${binaryVersion}`,
    );
  }
  const rulesHash = ruleSetHash(options.configFile, options.stylesDirectory);
  const version = producerVersion(binaryVersion, rulesHash);
  const producer: z.infer<typeof ProducerSchema> = {
    id: "vale",
    version,
    provenance: { kind: "rule", ruleId: "configured-rule-set" },
  };

  const inputs = cohort.entries.map((entry) => ({
    entry,
    file: path.resolve(options.corpusRoot, entry.source.file),
  }));
  const alertsByFile = runVale(
    options.valeBinary,
    options.configFile,
    inputs.map(({ file }) => file),
  );
  const artifacts = inputs.map(({ entry, file }) => {
    const source = fs.readFileSync(file, "utf8");
    const reference = sourceReference(entry.path, entry.source.revision, source);
    if (reference.contentHash !== entry.source.contentHash) {
      throw new Error(
        `${entry.artifactId} source hash mismatch: expected ${entry.source.contentHash}, got ${reference.contentHash}`,
      );
    }
    const findings = (alertsByFile.get(file) ?? [])
      .map((alert) => valeAlertToFinding(
        source,
        entry.path,
        entry.source.revision,
        version,
        alert,
      ))
      .sort(compareFindingRecords);
    return {
      artifactId: entry.artifactId,
      artifactType: entry.artifactType,
      split: entry.split,
      source: reference,
      findingIds: findings.map(({ finding }) => finding.findingId),
      findings,
    };
  });
  const runDigest = sha256(canonicalJson({
    cohortId: cohort.cohortId,
    producerVersion: version,
    findings: artifacts.map(({ artifactId, findingIds }) => ({ artifactId, findingIds })),
  })).slice("sha256:".length);
  const result = ValeProducerRunSchema.parse({
    schemaVersion: 1,
    recordType: "writing-editor-vale-producer-run",
    runId: `producer-run:v1:${runDigest}`,
    cohortId: cohort.cohortId,
    producer,
    vale: { binaryVersion, ruleSetHash: rulesHash },
    artifacts,
    summary: summary(artifacts),
  });
  writeJson(options.outputFile, result);
  return result;
}

function main(): void {
  const { values } = parseArgs({
    options: {
      cohort: { type: "string" },
      corpus: { type: "string" },
      params: { type: "string" },
      config: { type: "string" },
      styles: { type: "string" },
      output: { type: "string" },
      vale: { type: "string", default: "vale" },
    },
  });
  const args = ValeCliOptionsSchema.parse(values);
  const run = runValeProducer({
    cohortFile: args.cohort,
    corpusRoot: args.corpus,
    paramsFile: args.params,
    configFile: args.config,
    stylesDirectory: args.styles,
    outputFile: args.output,
    valeBinary: args.vale,
  });
  console.log(
    `Vale found ${run.summary.findings} issues in ${run.summary.artifactsWithFindings}/${run.summary.artifacts} artifacts as ${run.runId}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
