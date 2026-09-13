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

function writeManifest(directory: string, payload: Buffer): string {
  const file = path.join(directory, "model-manifest.json");
  fs.writeFileSync(file, `${JSON.stringify({
    schemaVersion: 1,
    recordType: "gector-model-manifest",
    modelId: "gector-2024-roberta-large",
    source: {
      repository: "https://github.com/grammarly/pillars-of-gec",
      revision: "1014de0bc90faddba0032acb5dec762c6c85d2e1",
    },
    checkpoint: {
      url: "https://example.invalid/checkpoint.th",
      filename: "checkpoint.th",
      bytes: payload.length,
      contentHash: sha256(payload),
    },
    usage: "evaluation-only",
    checkpointLicense: "not-stated-by-upstream",
  }, null, 2)}\n`);
  return file;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("GECToR model preparation", () => {
  test("pins the official checkpoint and upstream source revision", () => {
    const manifest = GectorModelManifestSchema.parse(
      JSON.parse(fs.readFileSync("model-manifest.json", "utf8")),
    );

    expect(manifest.source).toEqual({
      repository: "https://github.com/grammarly/pillars-of-gec",
      revision: "1014de0bc90faddba0032acb5dec762c6c85d2e1",
    });
    expect(manifest.checkpoint).toMatchObject({
      bytes: 1_442_177_179,
      contentHash: "sha256:77e1c9e0d7ad5507c16509fd765283dbce5221552aa7a90c37d143f1aeaddb10",
    });
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
      expect(url.toString()).toBe("https://example.invalid/checkpoint.th");
      expect(target).toBe(partialFile);
      expect(options.expectedBytes).toBe(payload.length);
      const offset = fs.statSync(target).size;
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
    expect(fs.existsSync(path.join(outputDirectory, "receipt.json"))).toBe(false);
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
    const download = vi.fn<CheckpointDownloader>();

    const receipt = await prepareGectorModel({ manifestFile, outputDirectory, download });

    expect(receipt.checkpoint.contentHash).toBe(sha256(payload));
    expect(download).not.toHaveBeenCalled();
  });

  test("rejects non-HTTPS checkpoint URLs", () => {
    expect(() => GectorModelManifestSchema.parse({
      schemaVersion: 1,
      recordType: "gector-model-manifest",
      modelId: "gector-2024-roberta-large",
      source: {
        repository: "https://github.com/grammarly/pillars-of-gec",
        revision: "1014de0bc90faddba0032acb5dec762c6c85d2e1",
      },
      checkpoint: {
        url: "http://example.invalid/checkpoint.th",
        filename: "checkpoint.th",
        bytes: 1,
        contentHash: `sha256:${"0".repeat(64)}`,
      },
      usage: "evaluation-only",
      checkpointLicense: "not-stated-by-upstream",
    })).toThrow("must use HTTPS");
  });
});
