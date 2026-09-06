import { describe, expect, it } from "vitest";
import {
  artifactKey,
  importJobPrefix,
  sourceImageKey,
  sourcePrefix,
} from "../src/keys";

describe("recipe import storage keys", () => {
  const jobId = "5d9bb640-6fa7-44ca-954c-87141c68fe8e";

  it("keeps every object beneath the import job prefix", () => {
    expect(importJobPrefix(jobId)).toBe(`imports/${jobId}/`);
    expect(sourcePrefix(jobId)).toBe(`imports/${jobId}/source/`);
    expect(sourceImageKey(jobId, 2, "webp")).toBe(
      `imports/${jobId}/source/2.webp`,
    );
    expect(artifactKey(jobId, "extract", "source-manifest.json")).toBe(
      `imports/${jobId}/extract/source-manifest.json`,
    );
  });

  it("builds keys for every artifact stage", () => {
    expect(artifactKey(jobId, "normalize", "normalized.json")).toBe(
      `imports/${jobId}/normalize/normalized.json`,
    );
    expect(artifactKey(jobId, "canonicalize", "canonical.json")).toBe(
      `imports/${jobId}/canonicalize/canonical.json`,
    );
    expect(artifactKey(jobId, "finalize", "draft.json")).toBe(
      `imports/${jobId}/finalize/draft.json`,
    );
  });
});
