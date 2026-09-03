import { describe, expect, it, vi } from "vitest";
import type { Env, ReviewWorkflowParams } from "../src/env";
import {
  recordReviewTerminal,
  type PreparedReview,
  type ReviewCoverageMode,
} from "../src/review-engine";
import {
  assertReplaySchemaCompatible,
  persistReplayInput,
} from "../src/replay-input";

const params: ReviewWorkflowParams = {
  deliveryId: "delivery-434",
  eventName: "pull_request",
  action: "synchronize",
  repository: "acme/widgets",
  pullRequestNumber: 434,
  headSha: "b".repeat(40),
  force: false,
};

function prepared(mode: ReviewCoverageMode): PreparedReview {
  const finding = {
    findingId: "f_prior",
    file: "src/app.ts",
    title: "Prior finding",
    hunkIds: ["h_prior"],
    evidence: "DATABASE_URL=postgres://user:password@example.test/db",
  };
  return {
    baseSha: "a".repeat(40),
    headSha: "b".repeat(40),
    diffFingerprint: "diff-hash",
    configFingerprint: "config-hash",
    fullDiff: "diff --git a/src/app.ts b/src/app.ts\n+AWS_SECRET_ACCESS_KEY=super-secret-value",
    diff: "+Authorization: Basic dXNlcjpwYXNzd29yZA==",
    context: "Authorization: Bearer abcdefghijklmnopqrstuvwxyz",
    guidelines: "Review carefully.",
    threads: String.raw`{"password":"quoted-secret-one-with-\"escaped-secret-tail",'api_key':'quoted-secret-two-with-\'single-secret-tail',"ａｐｉＫｅｙ":"compatibility-secret"}`,
    paths: ["src/app.ts"],
    omitted: [],
    priorOpenFindings: [finding],
    replayFindings: mode === "incremental" ? [finding] : [],
    coverage: {
      mode,
      reason: `${mode} fixture`,
      totalHunks: 1,
      reviewedHunkIds: mode === "skipped" ? [] : ["h_current"],
      unchangedHunkIds: mode === "incremental" ? ["h_prior"] : [],
      skippedHunkIds: mode === "skipped" ? ["h_current"] : [],
      affectedFindingIds: mode === "incremental" ? ["f_prior"] : [],
      paths: ["src/app.ts"],
      skippedPaths: [],
    },
  };
}

function fixture() {
  const put = vi.fn().mockResolvedValue(undefined);
  const env = {
    REVIEW_DATA: { put },
    AI_REVIEW_DATA_RETENTION_DAYS: "30",
    AI_REVIEW_MAX_RUNS_PER_PR: "20",
    AI_REVIEW_MAX_PR_COST_USD: "5",
  } as unknown as Env;
  return { env, put };
}

const configuration = {
  prompt: {
    version: "prompt-v1",
    scoutSystem: "Scout.",
    scoutSchema: { type: "object" },
    mergerSystem: "Merge.",
    mergerSchema: { type: "object" },
  },
  modelSettings: {
    openRouterScouts: ["model/scout"],
    openCodeScouts: [],
    merger: "model/merger",
    requireZeroDataRetention: true,
    scoutMaxTokens: 8_000,
    mergerMaxTokens: 6_000,
    openRouterScoutMaxPrices: { "model/scout": { prompt: 1, completion: 2 } },
  },
  policy: {
    publication: { version: "policy-v1" },
    credentials: {
      password: "structured-secret-three",
      algorithm: "bcrypt",
      myAPIKey: "acronym-sensitive-value",
      encryptionKey: "encryption-sensitive-value",
      session: "session-sensitive-value",
      cookie: "cookie-sensitive-value",
      bearer: "bearer-sensitive-value",
    },
  },
};

describe("replay input corpus", () => {
  for (const mode of ["full", "incremental", "skipped"] as const) {
    it(`captures ${mode} coverage using immutable inputs`, async () => {
      const { env, put } = fixture();
      await persistReplayInput({
        env,
        params,
        instanceId: `run-${mode}`,
        status: mode === "skipped" ? "skipped" : "published",
        prepared: prepared(mode),
        timestamp: new Date("2026-08-31T12:00:00Z"),
        ...configuration,
      });

      const parsed: unknown = JSON.parse(String(put.mock.calls[0]?.[1]));
      assertReplaySchemaCompatible(parsed);
      const snapshot = parsed as typeof parsed & {
        git: { baseSha: string; headSha: string };
        decision: { coverage: { mode: string } };
        input: { priorOpenFindings: unknown[]; affectedOpenFindings: unknown[] };
        policy: { credentials: { algorithm: string } };
        provenance: { liveCredentialsIncluded: boolean };
      };
      expect(snapshot.git).toEqual({ baseSha: "a".repeat(40), headSha: "b".repeat(40) });
      expect(snapshot.decision.coverage.mode).toBe(mode);
      expect(snapshot.input.priorOpenFindings).toHaveLength(1);
      expect(snapshot.input.affectedOpenFindings).toHaveLength(mode === "incremental" ? 1 : 0);
      expect(JSON.stringify(snapshot)).not.toContain("super-secret-value");
      expect(JSON.stringify(snapshot)).not.toContain("abcdefghijklmnopqrstuvwxyz");
      expect(JSON.stringify(snapshot)).not.toContain("dXNlcjpwYXNzd29yZA");
      expect(JSON.stringify(snapshot)).not.toContain("postgres://user:password");
      expect(JSON.stringify(snapshot)).not.toContain("quoted-secret-one");
      expect(JSON.stringify(snapshot)).not.toContain("quoted-secret-two");
      expect(JSON.stringify(snapshot)).not.toContain("escaped-secret-tail");
      expect(JSON.stringify(snapshot)).not.toContain("single-secret-tail");
      expect(JSON.stringify(snapshot)).not.toContain("compatibility-secret");
      expect(JSON.stringify(snapshot)).not.toContain("structured-secret-three");
      expect(JSON.stringify(snapshot)).not.toContain("acronym-sensitive-value");
      expect(JSON.stringify(snapshot)).not.toContain("encryption-sensitive-value");
      expect(JSON.stringify(snapshot)).not.toContain("session-sensitive-value");
      expect(JSON.stringify(snapshot)).not.toContain("cookie-sensitive-value");
      expect(JSON.stringify(snapshot)).not.toContain("bearer-sensitive-value");
      expect(snapshot.policy.credentials.algorithm).toBe("bcrypt");
      expect(snapshot.provenance.liveCredentialsIncluded).toBe(false);
      const manifest = JSON.parse(String(put.mock.calls[1]?.[1]));
      expect(manifest.snapshot.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(manifest.productionRecordKey).toContain(`run-${mode}`);
      expect(manifest.findingOutcomesPrefix).toContain("/findings");
      expect(manifest.retention.days).toBe(30);
    });
  }

  it("writes byte-identical objects when a Workflow step retries", async () => {
    const { env, put } = fixture();
    const input = {
      env,
      params,
      instanceId: "run-retry",
      status: "published" as const,
      prepared: prepared("incremental"),
      timestamp: new Date("2026-08-31T12:00:00Z"),
      ...configuration,
    };
    await persistReplayInput(input);
    await persistReplayInput(input);
    expect(put.mock.calls[0]?.slice(0, 2)).toEqual(put.mock.calls[2]?.slice(0, 2));
    expect(put.mock.calls[1]?.slice(0, 2)).toEqual(put.mock.calls[3]?.slice(0, 2));
  });

  it("writes the production record before the snapshot and manifest commit marker", async () => {
    const put = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("snapshot write failed"));
    const env = {
      ...fixture().env,
      REVIEW_DATA: { put },
      AI_REVIEW_PROMPT_VERSION: "prompt-v1",
    } as unknown as Env;

    await expect(recordReviewTerminal({
      env,
      params,
      instanceId: "run-interrupted",
      status: "published",
      prepared: prepared("full"),
      timestamp: new Date("2026-08-31T12:00:00Z"),
    })).rejects.toThrow("snapshot write failed");

    expect(String(put.mock.calls[0]?.[0])).toMatch(/\/published\.json$/);
    expect(String(put.mock.calls[1]?.[0])).toMatch(/\/input-v1\.json$/);
    expect(put).toHaveBeenCalledTimes(2);
  });

  it("rejects unsupported schema versions", () => {
    expect(() => assertReplaySchemaCompatible({
      schemaVersion: 2,
      recordType: "ai-review-replay-input",
    })).toThrow("Unsupported replay input schema version: 2");
  });

  it("accepts forward-compatible fields in nested snapshot objects", async () => {
    const { env, put } = fixture();
    await persistReplayInput({
      env,
      params,
      instanceId: "run-forward-compatible",
      status: "published",
      prepared: prepared("full"),
      timestamp: new Date("2026-08-31T12:00:00Z"),
      ...configuration,
    });
    const snapshot = JSON.parse(String(put.mock.calls[0]?.[1])) as {
      git: Record<string, unknown>;
      input: Record<string, unknown>;
      prompt: Record<string, unknown>;
    };
    snapshot.git.objectFormat = "sha1";
    snapshot.input.contextFormat = "bounded-v2";
    snapshot.prompt.templateEngine = "liquid";

    expect(() => assertReplaySchemaCompatible(snapshot)).not.toThrow();
  });
});
