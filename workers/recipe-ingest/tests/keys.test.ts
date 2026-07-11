import { describe, expect, it } from "vitest";
import { artifactKey, sourceImageKey, sourcePrefix } from "../src/keys";

describe("R2 key derivation", () => {
  const jobId = "0b7f4a52-3c2f-4a1e-9b1c-2f1d0e9a8b7c";

  it("derives source keys under the job's source prefix", () => {
    expect(sourceImageKey(jobId, 0, "jpg")).toBe(
      `imports/${jobId}/source/0.jpg`,
    );
    expect(
      sourceImageKey(jobId, 2, "webp").startsWith(sourcePrefix(jobId)),
    ).toBe(true);
  });

  it("derives stage artifact keys from job, stage, and filename", () => {
    expect(artifactKey(jobId, "extract", "extraction.json")).toBe(
      `imports/${jobId}/extract/extraction.json`,
    );
    expect(artifactKey(jobId, "finalize", "draft.json")).toBe(
      `imports/${jobId}/finalize/draft.json`,
    );
  });
});
