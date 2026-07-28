import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env, ReviewWorkflowParams } from "../src/env";

const engine = vi.hoisted(() => ({
  claimReview: vi.fn(),
  completeReview: vi.fn(),
  failReview: vi.fn(),
  mergeFindings: vi.fn(),
  prepareReview: vi.fn(),
  publishReview: vi.fn(),
  recordReview: vi.fn(),
  runScouts: vi.fn(),
}));

vi.mock("../src/review-engine", () => engine);

import { ReviewWorkflow } from "../src/index";

const payload: ReviewWorkflowParams = {
  deliveryId: "delivery-workflow",
  eventName: "pull_request",
  action: "synchronize",
  repository: "Robbie-Palmer/personal-site",
  pullRequestNumber: 837,
  headSha: "a".repeat(40),
  force: false,
};

const event = {
  instanceId: "review-delivery-workflow",
  payload,
  timestamp: new Date("2026-07-28T12:00:00Z"),
} as WorkflowEvent<ReviewWorkflowParams>;

const prepared = {
  headSha: payload.headSha,
  diffFingerprint: "diff-fingerprint",
  configFingerprint: "config-fingerprint",
  diff: "diff --git a/app.ts b/app.ts",
  paths: ["app.ts"],
  omitted: [],
};

const scouts = {
  models: ["model/scout"],
  candidates: { "model/scout": [] },
  failed: [],
  candidateCounts: { "model/scout": 0 },
  invalidCounts: { "model/scout": 0 },
  outOfScopeCounts: { "model/scout": 0 },
  costs: { "model/scout": 0.4 },
  metrics: [],
};

const merged = {
  result: { summary: "Clean.", findings: [] },
  cost: 0.2,
};

function fixture() {
  const workflow = new ReviewWorkflow(
    {} as ExecutionContext,
    {} as unknown as Env,
  );
  const step = {
    do: vi.fn(
      async <T>(_name: string, operation: () => Promise<T>): Promise<T> =>
        operation(),
    ),
  } as unknown as WorkflowStep;
  return { workflow, step };
}

beforeEach(() => {
  vi.resetAllMocks();
  engine.prepareReview.mockResolvedValue(prepared);
  engine.claimReview.mockResolvedValue({
    claimed: true,
    previousState: { runs: 0, total_usd: 0 },
  });
  engine.runScouts.mockResolvedValue(scouts);
  engine.mergeFindings.mockResolvedValue(merged);
  engine.publishReview.mockResolvedValue({
    commentId: 123,
    runCostUsd: 0.6,
  });
  engine.recordReview.mockResolvedValue(undefined);
  engine.completeReview.mockResolvedValue(undefined);
  engine.failReview.mockResolvedValue(undefined);
});

describe("ReviewWorkflow orchestration", () => {
  it("runs and records every retryable review step", async () => {
    const { workflow, step } = fixture();

    await workflow.run(event, step);

    expect(engine.runScouts).toHaveBeenCalledOnce();
    expect(engine.mergeFindings).toHaveBeenCalledOnce();
    expect(engine.publishReview).toHaveBeenCalledOnce();
    expect(engine.recordReview).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: event.instanceId,
        prepared,
        scouts,
        merged,
        timestamp: event.timestamp,
      }),
    );
    expect(engine.completeReview).toHaveBeenCalledOnce();
    expect(
      vi.mocked(step.do).mock.calls.map(([name]) => name),
    ).toEqual([
      "prepare-review",
      "claim-review",
      "run-current-scout-ensemble",
      "merge-current-scout-findings",
      "publish-rolling-comment",
      "record-versioned-review",
      "complete-review-state",
    ]);
  });

  it("publishes an empty review without invoking models", async () => {
    engine.prepareReview.mockResolvedValue({ ...prepared, diff: "" });
    const { workflow, step } = fixture();

    await workflow.run(event, step);

    expect(engine.runScouts).not.toHaveBeenCalled();
    expect(engine.mergeFindings).not.toHaveBeenCalled();
    expect(engine.publishReview).toHaveBeenCalledWith(
      expect.anything(),
      payload,
      expect.objectContaining({ diff: "" }),
      expect.objectContaining({ models: [], metrics: [] }),
      expect.objectContaining({
        result: {
          summary: "No reviewable text changes found.",
          findings: [],
        },
        cost: 0,
      }),
      { runs: 0, total_usd: 0 },
    );
  });

  it("stops after eligibility or durable-claim rejection", async () => {
    const skipped = fixture();
    engine.prepareReview.mockResolvedValueOnce({
      skipReason: "pull request is draft",
      paths: [],
      omitted: [],
    });
    await skipped.workflow.run(event, skipped.step);
    expect(engine.claimReview).not.toHaveBeenCalled();

    engine.prepareReview.mockResolvedValueOnce(prepared);
    engine.claimReview.mockResolvedValueOnce({
      claimed: false,
      reason: "already reviewed",
      previousState: { runs: 1, total_usd: 0.5 },
    });
    const duplicate = fixture();
    await duplicate.workflow.run(event, duplicate.step);
    expect(engine.runScouts).not.toHaveBeenCalled();
  });

  it("records known model spend before propagating a failure", async () => {
    engine.mergeFindings.mockRejectedValue(new Error("merger unavailable"));
    const { workflow, step } = fixture();

    await expect(workflow.run(event, step)).rejects.toThrow(
      "merger unavailable",
    );

    expect(engine.failReview).toHaveBeenCalledWith(
      expect.anything(),
      payload,
      event.instanceId,
      expect.any(Error),
      0.4,
    );
  });

  it("preserves the original failure when failure-state recording also fails", async () => {
    engine.runScouts.mockRejectedValue(new Error("scouts unavailable"));
    engine.failReview.mockRejectedValue(new Error("coordinator unavailable"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { workflow, step } = fixture();

    await expect(workflow.run(event, step)).rejects.toThrow(
      "scouts unavailable",
    );

    expect(consoleError).toHaveBeenCalledWith(
      "Could not record failed review state",
      { type: "Error" },
    );
  });
});
