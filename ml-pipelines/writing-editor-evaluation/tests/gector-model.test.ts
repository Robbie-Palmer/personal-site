import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import {
  type CheckpointDownloader,
  type CurlRunner,
  downloadCheckpoint,
  GectorModelManifestSchema,
  prepareGectorModel,
} from "../src/prepare-gector-model";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gector-model-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

function sha256(value: Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

interface TestArtifact {
  url: string;
  filename: string;
  bytes: number;
  contentHash: string;
  sourceRepository: string;
  sourceRevision: string;
  mediaType: string;
}

function modelManifest(checkpoint: TestArtifact, runtimeAssets: TestArtifact[]) {
  const config = Buffer.from(JSON.stringify({
    checkpoint: checkpoint.filename,
    checkpointLicense: "not-stated-by-upstream",
    modelId: "gector-2024-roberta-large",
    sourceRepository: checkpoint.sourceRepository,
    sourceRevision: checkpoint.sourceRevision,
    usage: "evaluation-only",
  }));
  const descriptor = (artifact: TestArtifact) => ({
    mediaType: artifact.mediaType,
    digest: artifact.contentHash,
    size: artifact.bytes,
    urls: [artifact.url],
    annotations: {
      "org.opencontainers.image.title": artifact.filename,
      "org.opencontainers.image.source": artifact.sourceRepository,
      "org.opencontainers.image.revision": artifact.sourceRevision,
    },
  });
  return {
    schemaVersion: 2,
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    artifactType: "application/vnd.robbiepalmer.gector.model.v1",
    config: {
      mediaType: "application/vnd.robbiepalmer.gector.config.v1+json",
      digest: sha256(config),
      size: config.byteLength,
      data: config.toString("base64"),
      annotations: { "org.opencontainers.image.title": "gector-model-config.json" },
    },
    layers: [descriptor(checkpoint), ...runtimeAssets.map(descriptor)],
    annotations: {
      "org.opencontainers.image.title": "GECToR test model",
      "org.opencontainers.image.source": checkpoint.sourceRepository,
      "org.opencontainers.image.revision": checkpoint.sourceRevision,
    },
  };
}

function writeManifest(directory: string, payload: Buffer): string {
  const file = path.join(directory, "model-manifest.json");
  fs.writeFileSync(file, `${JSON.stringify(modelManifest(
    {
      url: "https://example.invalid/checkpoint.th",
      filename: "checkpoint.th",
      bytes: payload.length,
      contentHash: sha256(payload),
      sourceRepository: "https://github.com/grammarly/pillars-of-gec",
      sourceRevision: "1014de0bc90faddba0032acb5dec762c6c85d2e1",
      mediaType: "application/vnd.pytorch.state-dict",
    },
    [{
      sourceRepository: "https://example.invalid/runtime",
      sourceRevision: "a".repeat(40),
      url: "https://example.invalid/runtime.txt",
      filename: "runtime/runtime.txt",
      bytes: payload.length,
      contentHash: sha256(payload),
      mediaType: "text/plain",
    }],
  ), null, 2)}\n`);
  return file;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("GECToR model preparation", () => {
  test("uses an OCI artifact manifest for the pinned model", () => {
    const manifest = GectorModelManifestSchema.parse(
      JSON.parse(fs.readFileSync("model-manifest.json", "utf8")),
    );

    expect(manifest.oci).toMatchObject({
      schemaVersion: 2,
      mediaType: "application/vnd.oci.image.manifest.v1+json",
      artifactType: "application/vnd.robbiepalmer.gector.model.v1",
    });
    expect(manifest.oci.layers.every(({ digest, mediaType, size }) =>
      digest.startsWith("sha256:") && mediaType.length > 0 && size > 0
    )).toBe(true);
    expect(manifest.source).toEqual({
      repository: "https://github.com/grammarly/pillars-of-gec",
      revision: "1014de0bc90faddba0032acb5dec762c6c85d2e1",
    });
    expect(manifest.checkpoint).toMatchObject({
      bytes: 1_442_177_179,
      contentHash: "sha256:77e1c9e0d7ad5507c16509fd765283dbce5221552aa7a90c37d143f1aeaddb10",
    });
    expect(manifest.runtimeAssets).toHaveLength(9);
    expect(new Set(manifest.runtimeAssets.map(({ sourceRevision }) => sourceRevision))).toEqual(
      new Set([
        "722cf37b1afa9454edce342e7895e588b6ff1d59",
        "9f699f274dfab524185c27e11fc2cc70f07045f0",
      ]),
    );
  });

  test("rejects an OCI manifest whose embedded config does not match its descriptor", () => {
    const payload = Buffer.from("fixture");
    const manifest = modelManifest({
      url: "https://example.invalid/checkpoint.th",
      filename: "checkpoint.th",
      bytes: payload.length,
      contentHash: sha256(payload),
      sourceRepository: "https://github.com/grammarly/pillars-of-gec",
      sourceRevision: "1014de0bc90faddba0032acb5dec762c6c85d2e1",
      mediaType: "application/vnd.pytorch.state-dict",
    }, []);
    manifest.config.digest = `sha256:${"0".repeat(64)}`;

    expect(() => GectorModelManifestSchema.parse(manifest))
      .toThrow("embedded config digest does not match descriptor");
  });

  test("resumes, verifies, and records the declared checkpoint", async () => {
    const payload = Buffer.from("official-checkpoint-fixture");
    const directory = temporaryDirectory();
    const manifestFile = writeManifest(directory, payload);
    const outputDirectory = path.join(directory, "model");
    const partialFile = path.join(outputDirectory, "checkpoint.th.partial");
    fs.mkdirSync(outputDirectory);
    fs.writeFileSync(partialFile, payload.subarray(0, 8));

    const download: CheckpointDownloader = async (url, target, options) => {
      expect(options.expectedBytes).toBe(payload.length);
      expect(url.hostname).toBe("example.invalid");
      const offset = fs.existsSync(target) ? fs.statSync(target).size : 0;
      fs.appendFileSync(target, payload.subarray(offset));
    };
    const receipt = await prepareGectorModel({
      manifestFile,
      outputDirectory,
      download,
    });

    expect(fs.readFileSync(path.join(outputDirectory, "checkpoint.th"))).toEqual(payload);
    expect(fs.existsSync(partialFile)).toBe(false);
    expect(receipt.checkpoint).toEqual({
      file: "checkpoint.th",
      bytes: payload.length,
      contentHash: sha256(payload),
    });
    expect(receipt.runtimeAssets).toEqual([{
      file: "runtime/runtime.txt",
      bytes: payload.length,
      contentHash: sha256(payload),
      sourceRepository: "https://example.invalid/runtime",
      sourceRevision: "a".repeat(40),
    }]);
    expect(JSON.parse(fs.readFileSync(path.join(outputDirectory, "receipt.json"), "utf8")))
      .toEqual(receipt);
  });

  test("uses hardened curl options while preserving a partial download", async () => {
    const payload = Buffer.from("official-checkpoint-fixture");
    const directory = temporaryDirectory();
    const partialFile = path.join(directory, "checkpoint.th.partial");
    fs.writeFileSync(partialFile, payload.subarray(0, 8));
    const runCurl: CurlRunner = vi.fn((_binary, arguments_) => {
      expect(arguments_).toContain("=https");
      expect(arguments_).toContain("--continue-at");
      expect(arguments_).toContain("--retry-all-errors");
      expect(arguments_).toContain("60");
      fs.appendFileSync(partialFile, payload.subarray(8));
    });

    await downloadCheckpoint(
      new URL("https://example.invalid/checkpoint.th"),
      partialFile,
      { expectedBytes: payload.length, timeoutMs: 60_000 },
      runCurl,
    );

    expect(runCurl).toHaveBeenCalledOnce();
    expect(fs.readFileSync(partialFile)).toEqual(payload);
  });

  test("does not download a complete partial file", async () => {
    const payload = Buffer.from("official-checkpoint-fixture");
    const directory = temporaryDirectory();
    const partialFile = path.join(directory, "checkpoint.th.partial");
    fs.writeFileSync(partialFile, payload);
    const runCurl = vi.fn<CurlRunner>();

    await downloadCheckpoint(
      new URL("https://example.invalid/checkpoint.th"),
      partialFile,
      { expectedBytes: payload.length, timeoutMs: 60_000 },
      runCurl,
    );

    expect(runCurl).not.toHaveBeenCalled();
  });

  test("rejects an oversized partial file", async () => {
    const directory = temporaryDirectory();
    const partialFile = path.join(directory, "checkpoint.th.partial");
    fs.writeFileSync(partialFile, "too-large");

    await expect(downloadCheckpoint(
      new URL("https://example.invalid/checkpoint.th"),
      partialFile,
      { expectedBytes: 1, timeoutMs: 60_000 },
    )).rejects.toThrow("partial checkpoint is larger than declared size");
  });

  test("rejects a downloaded checkpoint with the wrong hash", async () => {
    const payload = Buffer.from("official-checkpoint-fixture");
    const directory = temporaryDirectory();
    const manifestFile = writeManifest(directory, payload);
    const outputDirectory = path.join(directory, "model");
    const download: CheckpointDownloader = async (_url, target) => {
      fs.writeFileSync(target, Buffer.alloc(payload.length));
    };

    await expect(prepareGectorModel({ manifestFile, outputDirectory, download }))
      .rejects.toThrow("checkpoint hash mismatch");
    expect(fs.existsSync(path.join(outputDirectory, "checkpoint.th"))).toBe(false);
    expect(fs.existsSync(path.join(outputDirectory, "checkpoint.th.partial"))).toBe(false);
    expect(fs.existsSync(path.join(outputDirectory, "receipt.json"))).toBe(false);

    await prepareGectorModel({
      manifestFile,
      outputDirectory,
      download: async (_url, target) => fs.writeFileSync(target, payload),
    });
    expect(fs.readFileSync(path.join(outputDirectory, "checkpoint.th"))).toEqual(payload);
  });

  test("rejects an invalid existing checkpoint without downloading again", async () => {
    const payload = Buffer.from("official-checkpoint-fixture");
    const directory = temporaryDirectory();
    const manifestFile = writeManifest(directory, payload);
    const outputDirectory = path.join(directory, "model");
    fs.mkdirSync(outputDirectory);
    fs.writeFileSync(path.join(outputDirectory, "checkpoint.th"), "wrong");
    const download = vi.fn<CheckpointDownloader>();

    await expect(prepareGectorModel({ manifestFile, outputDirectory, download }))
      .rejects.toThrow("checkpoint size mismatch");
    expect(download).not.toHaveBeenCalled();
  });

  test("reuses a valid existing checkpoint", async () => {
    const payload = Buffer.from("official-checkpoint-fixture");
    const directory = temporaryDirectory();
    const manifestFile = writeManifest(directory, payload);
    const outputDirectory = path.join(directory, "model");
    fs.mkdirSync(outputDirectory);
    fs.writeFileSync(path.join(outputDirectory, "checkpoint.th"), payload);
    fs.mkdirSync(path.join(outputDirectory, "runtime"));
    fs.writeFileSync(path.join(outputDirectory, "runtime/runtime.txt"), payload);
    const download = vi.fn<CheckpointDownloader>();

    const receipt = await prepareGectorModel({ manifestFile, outputDirectory, download });

    expect(receipt.checkpoint.contentHash).toBe(sha256(payload));
    expect(download).not.toHaveBeenCalled();
  });

  test("rejects non-HTTPS checkpoint URLs", () => {
    expect(() => GectorModelManifestSchema.parse(modelManifest(
      {
        url: "http://example.invalid/checkpoint.th",
        filename: "checkpoint.th",
        bytes: 1,
        contentHash: `sha256:${"0".repeat(64)}`,
        sourceRepository: "https://github.com/grammarly/pillars-of-gec",
        sourceRevision: "1014de0bc90faddba0032acb5dec762c6c85d2e1",
        mediaType: "application/vnd.pytorch.state-dict",
      },
      [{
        sourceRepository: "https://example.invalid/runtime",
        sourceRevision: "a".repeat(40),
        url: "https://example.invalid/runtime.txt",
        filename: "runtime.txt",
        bytes: 1,
        contentHash: `sha256:${"0".repeat(64)}`,
        mediaType: "text/plain",
      }],
    ))).toThrow("must use HTTPS");
  });
});
