import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { readJson, writeJson } from "./files";

const ContentHashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const RelativeFileSchema = z.string().min(1).superRefine((value, context) => {
  const segments = value.split("/");
  if (
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes(":") ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    context.addIssue({ code: "custom", message: "must be a safe relative path" });
  }
});

const DownloadedArtifactSchema = z.object({
  url: z.url().refine((url) => url.startsWith("https://"), "must use HTTPS"),
  filename: RelativeFileSchema,
  bytes: z.number().int().positive(),
  contentHash: ContentHashSchema,
}).strict();

export const GectorModelManifestSchema = z.object({
  schemaVersion: z.literal(1),
  recordType: z.literal("gector-model-manifest"),
  modelId: z.literal("gector-2024-roberta-large"),
  source: z.object({
    repository: z.url(),
    revision: z.string().regex(/^[a-f0-9]{40}$/),
  }).strict(),
  checkpoint: DownloadedArtifactSchema,
  runtimeAssets: z.array(DownloadedArtifactSchema.extend({
    sourceRepository: z.url(),
    sourceRevision: z.string().regex(/^[a-f0-9]{40}$/),
  }).strict()).min(1),
  usage: z.literal("evaluation-only"),
  checkpointLicense: z.literal("not-stated-by-upstream"),
}).strict();
export type GectorModelManifest = z.infer<typeof GectorModelManifestSchema>;

export interface DownloadOptions {
  expectedBytes: number;
  timeoutMs: number;
}

export type CurlRunner = (
  binary: string,
  arguments_: string[],
  options: { stdio: "inherit" },
) => void;

export type CheckpointDownloader = (
  url: URL,
  partialFile: string,
  options: DownloadOptions,
) => Promise<void>;

export interface PrepareGectorModelOptions {
  manifestFile: string;
  outputDirectory: string;
  timeoutMs?: number;
  download?: CheckpointDownloader;
}

export interface GectorModelReceipt {
  schemaVersion: 1;
  recordType: "gector-model-receipt";
  modelId: "gector-2024-roberta-large";
  sourceRepository: string;
  sourceRevision: string;
  checkpoint: {
    file: string;
    bytes: number;
    contentHash: string;
  };
  runtimeAssets: {
    file: string;
    bytes: number;
    contentHash: string;
    sourceRepository: string;
    sourceRevision: string;
  }[];
  manifestContentHash: string;
}

function sha256File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const input = fs.createReadStream(file);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("error", reject);
    input.on("end", () => resolve(`sha256:${hash.digest("hex")}`));
  });
}

function sha256Bytes(value: Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

const defaultCurlRunner: CurlRunner = (binary, arguments_, options) => {
  execFileSync(binary, arguments_, options);
};

export async function downloadCheckpoint(
  url: URL,
  partialFile: string,
  options: DownloadOptions,
  runCurl: CurlRunner = defaultCurlRunner,
): Promise<void> {
  if (url.protocol !== "https:") {
    throw new Error(`refusing non-HTTPS checkpoint URL: ${url}`);
  }
  const startByte = fs.existsSync(partialFile) ? fs.statSync(partialFile).size : 0;
  if (startByte > options.expectedBytes) {
    throw new Error(
      `partial checkpoint is larger than declared size: ${startByte} > ${options.expectedBytes}`,
    );
  }
  if (startByte === options.expectedBytes) return;

  process.stdout.write(
    `Downloading checkpoint from byte ${startByte} of ${options.expectedBytes}\n`,
  );
  runCurl("curl", [
    "--proto", "=https",
    "--proto-redir", "=https",
    "--fail",
    "--location",
    "--retry", "5",
    "--retry-all-errors",
    "--continue-at", "-",
    "--speed-limit", "1",
    "--speed-time", String(Math.ceil(options.timeoutMs / 1000)),
    "--output", partialFile,
    url.toString(),
  ], { stdio: "inherit" });
  process.stdout.write(`Checkpoint download complete; verifying SHA-256\n`);
}

async function verifyArtifact(
  file: string,
  expectedBytes: number,
  expectedHash: string,
  label: string,
): Promise<void> {
  const bytes = fs.statSync(file).size;
  if (bytes !== expectedBytes) {
    throw new Error(`${label} size mismatch: expected ${expectedBytes}, got ${bytes}`);
  }
  const contentHash = await sha256File(file);
  if (contentHash !== expectedHash) {
    throw new Error(`${label} hash mismatch: expected ${expectedHash}, got ${contentHash}`);
  }
}

async function prepareArtifact(
  artifact: { url: string; filename: string; bytes: number; contentHash: string },
  outputDirectory: string,
  timeoutMs: number,
  download: CheckpointDownloader,
  label: string = artifact.filename,
): Promise<void> {
  const file = path.join(outputDirectory, artifact.filename);
  const partialFile = `${file}.partial`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    await verifyArtifact(file, artifact.bytes, artifact.contentHash, label);
    return;
  }
  await download(new URL(artifact.url), partialFile, {
    expectedBytes: artifact.bytes,
    timeoutMs,
  });
  try {
    await verifyArtifact(partialFile, artifact.bytes, artifact.contentHash, label);
  } catch (error) {
    fs.rmSync(partialFile, { force: true });
    throw error;
  }
  fs.renameSync(partialFile, file);
}

export async function prepareGectorModel(
  options: PrepareGectorModelOptions,
): Promise<GectorModelReceipt> {
  const manifestBytes = fs.readFileSync(options.manifestFile);
  const manifest = GectorModelManifestSchema.parse(readJson(options.manifestFile));
  const outputDirectory = path.resolve(options.outputDirectory);
  fs.mkdirSync(outputDirectory, { recursive: true });
  const download = options.download ?? downloadCheckpoint;
  const timeoutMs = options.timeoutMs ?? 60_000;
  await prepareArtifact(manifest.checkpoint, outputDirectory, timeoutMs, download, "checkpoint");
  for (const artifact of manifest.runtimeAssets) {
    await prepareArtifact(artifact, outputDirectory, timeoutMs, download);
  }

  const receipt: GectorModelReceipt = {
    schemaVersion: 1,
    recordType: "gector-model-receipt",
    modelId: manifest.modelId,
    sourceRepository: manifest.source.repository,
    sourceRevision: manifest.source.revision,
    checkpoint: {
      file: manifest.checkpoint.filename,
      bytes: manifest.checkpoint.bytes,
      contentHash: manifest.checkpoint.contentHash,
    },
    runtimeAssets: manifest.runtimeAssets.map((asset) => ({
      file: asset.filename,
      bytes: asset.bytes,
      contentHash: asset.contentHash,
      sourceRepository: asset.sourceRepository,
      sourceRevision: asset.sourceRevision,
    })),
    manifestContentHash: sha256Bytes(manifestBytes),
  };
  writeJson(path.join(outputDirectory, "receipt.json"), receipt);
  return receipt;
}

function main(): void {
  prepareGectorModel({
    manifestFile: "model-manifest.json",
    outputDirectory: "data/models/gector-2024",
  }).then((receipt) => {
    process.stdout.write(`Prepared ${receipt.modelId} (${receipt.checkpoint.contentHash})\n`);
  }).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
