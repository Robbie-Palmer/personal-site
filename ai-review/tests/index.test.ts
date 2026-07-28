import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { createHmac, generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env, ReviewWorkflowParams } from "../src/env";
import worker, { PullRequestCoordinator, ReviewWorkflow } from "../src/index";

const event: ReviewWorkflowParams = {
  deliveryId: "delivery-123",
  eventName: "pull_request",
  action: "synchronize",
  repository: "Robbie-Palmer/personal-site",
  pullRequestNumber: 821,
  headSha: "abcdef123456",
  force: false,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function coordinatorFixture(existingDeliveries: string[] = []) {
  const sqlExec = vi.fn((query: string): { toArray: () => unknown[] } => ({
    toArray: () =>
      query.startsWith("SELECT") &&
      existingDeliveries.includes(event.deliveryId)
        ? [{ delivery_id: event.deliveryId }]
        : [],
  }));
  const storage = {
    sql: { exec: sqlExec },
    kv: { put: vi.fn() },
    get: vi.fn(),
    delete: vi.fn(),
    getAlarm: vi.fn(
      (): Promise<number | null> => Promise.resolve(Date.now() + 2_000),
    ),
    setAlarm: vi.fn(),
    transactionSync: vi.fn((operation: () => unknown) => operation()),
  };
  const createBatch = vi.fn();
  const env = {
    AI_REVIEW_ENABLED: "true",
    AI_REVIEW_DEBOUNCE_SECONDS: "2",
    REVIEW_WORKFLOW: { createBatch },
  } as unknown as Env;
  const coordinator = new PullRequestCoordinator(
    { storage } as unknown as DurableObjectState,
    env,
  );

  return { coordinator, createBatch, env, sqlExec, storage };
}

function signedWebhookRequest(
  body: string,
  secret: string,
  headers: Record<string, string> = {},
): Request {
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  return new Request("https://ai-review.test/webhooks/github", {
    method: "POST",
    body,
    headers: {
      "x-github-delivery": "delivery-123",
      "x-github-event": "pull_request",
      "x-hub-signature-256": `sha256=${signature}`,
      ...headers,
    },
  });
}

describe("PullRequestCoordinator", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("initializes storage and schedules a new delivery", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T00:00:00.000Z"));
    const { coordinator, sqlExec, storage } = coordinatorFixture();

    const response = await coordinator.fetch(
      new Request("https://coordinator.test/events", {
        method: "POST",
        body: JSON.stringify(event),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      accepted: true,
      enabled: true,
    });
    expect(sqlExec.mock.calls[0]?.[0]).toContain("CREATE TABLE IF NOT EXISTS");
    expect(storage.kv.put).toHaveBeenCalledWith("latest-pending-event", event);
    expect(storage.setAlarm).toHaveBeenCalledWith(
      new Date("2026-07-27T00:00:02.000Z").getTime(),
    );
  });

  it("clamps immediate delays and defaults invalid configuration", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T00:00:00.000Z"));
    const immediate = coordinatorFixture();
    immediate.env.AI_REVIEW_DEBOUNCE_SECONDS = "0";
    await immediate.coordinator.fetch(
      new Request("https://coordinator.test/events", {
        method: "POST",
        body: JSON.stringify(event),
      }),
    );
    expect(immediate.storage.setAlarm).toHaveBeenCalledWith(
      new Date("2026-07-27T00:00:01.000Z").getTime(),
    );

    const invalid = coordinatorFixture();
    invalid.env.AI_REVIEW_DEBOUNCE_SECONDS = "not-a-number";
    await invalid.coordinator.fetch(
      new Request("https://coordinator.test/events", {
        method: "POST",
        body: JSON.stringify(event),
      }),
    );
    expect(invalid.storage.setAlarm).toHaveBeenCalledWith(
      new Date("2026-07-27T00:02:00.000Z").getTime(),
    );

    const excessive = coordinatorFixture();
    excessive.env.AI_REVIEW_DEBOUNCE_SECONDS = "999999999";
    await excessive.coordinator.fetch(
      new Request("https://coordinator.test/events", {
        method: "POST",
        body: JSON.stringify(event),
      }),
    );
    expect(excessive.storage.setAlarm).toHaveBeenCalledWith(
      new Date("2026-07-27T01:00:00.000Z").getTime(),
    );
  });

  it("coalesces rapid deliveries and moves the alarm to the quiet-period edge", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T00:00:00.000Z"));
    const { coordinator, storage } = coordinatorFixture();
    await coordinator.fetch(
      new Request("https://coordinator.test/events", {
        method: "POST",
        body: JSON.stringify(event),
      }),
    );

    vi.advanceTimersByTime(500);
    const latestEvent = {
      ...event,
      deliveryId: "delivery-456",
      headSha: "fedcba654321",
    };
    await coordinator.fetch(
      new Request("https://coordinator.test/events", {
        method: "POST",
        body: JSON.stringify(latestEvent),
      }),
    );

    expect(storage.kv.put).toHaveBeenLastCalledWith(
      "latest-pending-event",
      latestEvent,
    );
    expect(storage.setAlarm).toHaveBeenLastCalledWith(
      new Date("2026-07-27T00:00:02.500Z").getTime(),
    );
  });

  it("returns early for duplicate deliveries and unsupported methods", async () => {
    const { coordinator, storage } = coordinatorFixture([event.deliveryId]);

    const duplicate = await coordinator.fetch(
      new Request("https://coordinator.test/events", {
        method: "POST",
        body: JSON.stringify(event),
      }),
    );
    await expect(duplicate.json()).resolves.toEqual({
      accepted: true,
      duplicate: true,
    });
    expect(storage.kv.put).not.toHaveBeenCalled();
    expect(storage.setAlarm).not.toHaveBeenCalled();

    const rejected = await coordinator.fetch(
      new Request("https://coordinator.test/events"),
    );
    expect(rejected.status).toBe(405);
  });

  it("restores a missing alarm for a duplicate without extending an existing one", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T00:00:00.000Z"));
    const { coordinator, storage } = coordinatorFixture([event.deliveryId]);
    storage.getAlarm.mockResolvedValueOnce(null);

    await coordinator.fetch(
      new Request("https://coordinator.test/events", {
        method: "POST",
        body: JSON.stringify(event),
      }),
    );
    expect(storage.setAlarm).toHaveBeenCalledWith(
      new Date("2026-07-27T00:00:02.000Z").getTime(),
    );

    storage.setAlarm.mockClear();
    storage.getAlarm.mockResolvedValueOnce(
      new Date("2026-07-27T00:00:02.000Z").getTime(),
    );
    await coordinator.fetch(
      new Request("https://coordinator.test/events", {
        method: "POST",
        body: JSON.stringify(event),
      }),
    );
    expect(storage.setAlarm).not.toHaveBeenCalled();
  });

  it("rejects invalid coordinator event bodies", async () => {
    const { coordinator, storage } = coordinatorFixture();

    const wrongType = await coordinator.fetch(
      new Request("https://coordinator.test/events", {
        method: "POST",
        body: JSON.stringify({ ...event, pullRequestNumber: "821" }),
      }),
    );
    const malformed = await coordinator.fetch(
      new Request("https://coordinator.test/events", {
        method: "POST",
        body: "{",
      }),
    );
    const empty = await coordinator.fetch(
      new Request("https://coordinator.test/events", {
        method: "POST",
        body: "null",
      }),
    );

    expect(wrongType.status).toBe(400);
    expect(malformed.status).toBe(400);
    expect(empty.status).toBe(400);
    expect(storage.kv.put).not.toHaveBeenCalled();
  });

  it("does not schedule while reviews are disabled", async () => {
    const { coordinator, env, storage } = coordinatorFixture();
    env.AI_REVIEW_ENABLED = "false";

    const response = await coordinator.fetch(
      new Request("https://coordinator.test/events", {
        method: "POST",
        body: JSON.stringify(event),
      }),
    );

    await expect(response.json()).resolves.toMatchObject({ enabled: false });
    expect(storage.setAlarm).not.toHaveBeenCalled();
  });

  it("starts each delivery idempotently and clears the pending event", async () => {
    const { coordinator, createBatch, storage } = coordinatorFixture();
    storage.get.mockResolvedValue(event);

    await coordinator.alarm();

    expect(createBatch).toHaveBeenCalledWith([
      { id: `review-${event.deliveryId}`, params: event },
    ]);
    expect(storage.delete).toHaveBeenCalledWith("latest-pending-event");
  });

  it("leaves disabled or absent pending work alone", async () => {
    const { coordinator, createBatch, env, storage } = coordinatorFixture();
    storage.get.mockResolvedValue(event);
    env.AI_REVIEW_ENABLED = "false";
    await coordinator.alarm();
    expect(createBatch).not.toHaveBeenCalled();

    env.AI_REVIEW_ENABLED = "true";
    storage.get.mockResolvedValue(undefined);
    await coordinator.alarm();
    expect(createBatch).not.toHaveBeenCalled();
  });

  it("claims and completes a review run idempotently through internal routes", async () => {
    const { coordinator, sqlExec } = coordinatorFixture();
    const claim = await coordinator.fetch(
      new Request("https://coordinator.test/reviews/claim", {
        method: "POST",
        body: JSON.stringify({
          runId: "review-delivery-123",
          headSha: event.headSha,
          diffFingerprint: "diff-hash",
          configFingerprint: "config-hash",
          force: false,
          maxRuns: 20,
          maxCostUsd: 5,
        }),
      }),
    );
    await expect(claim.json()).resolves.toEqual({
      claimed: true,
      previousState: { runs: 0, total_usd: 0 },
    });
    expect(
      sqlExec.mock.calls.some(([query]) =>
        String(query).includes("INSERT INTO review_runs"),
      ),
    ).toBe(true);

    const completion = await coordinator.fetch(
      new Request("https://coordinator.test/reviews/complete", {
        method: "POST",
        body: JSON.stringify({
          runId: "review-delivery-123",
          headSha: event.headSha,
          costUsd: 0.42,
          commentId: 987,
          findings: [{ title: "Finding" }],
        }),
      }),
    );
    await expect(completion.json()).resolves.toEqual({ completed: true });
    expect(
      sqlExec.mock.calls.some(([query]) =>
        String(query).includes("SET status = 'completed'"),
      ),
    ).toBe(true);
  });

  it("rejects malformed internal review-state updates", async () => {
    const { coordinator } = coordinatorFixture();
    for (const path of [
      "/reviews/claim",
      "/reviews/complete",
      "/reviews/fail",
    ]) {
      const response = await coordinator.fetch(
        new Request(`https://coordinator.test${path}`, {
          method: "POST",
          body: "{}",
        }),
      );
      expect(response.status).toBe(400);
    }
  });

  it.each([
    [{ attempts: 20, runs: 18, total_cost: 1 }, "review-run budget"],
    [{ attempts: 2, runs: 2, total_cost: 5 }, "cost budget"],
  ])("refuses a claim after the per-PR %s is reached", async (aggregate, reason) => {
    const { coordinator, sqlExec } = coordinatorFixture();
    sqlExec.mockImplementation((query: string) => ({
      toArray: () =>
        query.includes("COUNT(*) AS attempts") ? [aggregate] : [],
    }));

    const response = await coordinator.fetch(
      new Request("https://coordinator.test/reviews/claim", {
        method: "POST",
        body: JSON.stringify({
          runId: "review-budgeted",
          headSha: event.headSha,
          diffFingerprint: "diff-hash",
          configFingerprint: "config-hash",
          force: false,
          maxRuns: 20,
          maxCostUsd: 5,
        }),
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      claimed: false,
      reason: expect.stringContaining(reason),
    });
    expect(
      sqlExec.mock.calls.some(([query]) =>
        String(query).includes("INSERT INTO review_runs"),
      ),
    ).toBe(false);
  });

  it("allows only one in-flight paid review per pull request", async () => {
    const { coordinator, sqlExec } = coordinatorFixture();
    sqlExec.mockImplementation((query: string) => ({
      toArray: () => {
        if (query.includes("COUNT(*) AS attempts")) {
          return [{ attempts: 1, runs: 0, total_cost: 0 }];
        }
        if (query.includes("WHERE status = 'running'")) {
          return [{ run_id: "review-earlier-head" }];
        }
        return [];
      },
    }));

    const response = await coordinator.fetch(
      new Request("https://coordinator.test/reviews/claim", {
        method: "POST",
        body: JSON.stringify({
          runId: "review-later-head",
          headSha: "def456",
          diffFingerprint: "new-diff-hash",
          configFingerprint: "new-config-hash",
          force: false,
          maxRuns: 20,
          maxCostUsd: 5,
        }),
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      claimed: false,
      reason: "another review is already running",
    });
    expect(
      sqlExec.mock.calls.some(([query]) =>
        String(query).includes("INSERT INTO review_runs"),
      ),
    ).toBe(false);
  });
});

describe("ReviewWorkflow", () => {
  it("stops before model calls when the pull request is closed", async () => {
    const put = vi.fn();
    const privateKey = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    }).privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ token: "installation-token" }))
      .mockResolvedValueOnce(
        Response.json({
          state: "closed",
          draft: false,
          author_association: "OWNER",
          user: { login: "robbie" },
          head: {
            sha: event.headSha,
            repo: { full_name: event.repository },
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const env = {
      REVIEW_DATA: { put },
      AI_REVIEW_PROMPT_VERSION: "stateless-parity-v1",
      AI_REVIEW_MODELS: "",
      AI_REVIEW_OPENCODE_MODELS: "",
      AI_REVIEW_MERGER_MODEL: "",
      AI_REVIEW_IGNORED_AUTHORS: "",
      AI_REVIEW_ZDR: "false",
      AI_REVIEW_APP_ID: "123",
      AI_REVIEW_APP_INSTALLATION_ID: "456",
      AI_REVIEW_APP_PRIVATE_KEY: privateKey,
      OPENROUTER_API_KEY: "openrouter-key",
    } as unknown as Env;
    const workflow = new ReviewWorkflow({} as ExecutionContext, env);
    const step = {
      do: vi.fn(async (_name: string, operation: () => Promise<void>) =>
        operation(),
      ),
    } as unknown as WorkflowStep;

    await workflow.run(
      {
        instanceId: "review-delivery-123",
        payload: event,
        timestamp: new Date("2026-07-26T00:00:00.000Z"),
      } as WorkflowEvent<ReviewWorkflowParams>,
      step,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(put).not.toHaveBeenCalled();
    expect(step.do).toHaveBeenCalledTimes(1);
  });
});

describe("HTTP Worker", () => {
  const secret = "webhook-secret";
  const validBody = JSON.stringify({
    action: "opened",
    repository: { full_name: "Robbie-Palmer/personal-site" },
    pull_request: { number: 821, head: { sha: "abcdef123456" } },
  });

  function workerEnv() {
    const fetch = vi.fn(() => Response.json({ accepted: true }));
    return {
      env: {
        AI_REVIEW_ENABLED: "false",
        AI_REVIEW_REPOSITORY: "Robbie-Palmer/personal-site",
        AI_REVIEW_WEBHOOK_SECRET: secret,
        PR_STATE: {
          idFromName: vi.fn(() => "coordinator-id"),
          get: vi.fn(() => ({ fetch })),
        },
        REVIEW_DATA: {},
        REVIEW_WORKFLOW: {},
      } as unknown as Env,
      fetch,
    };
  }

  it("serves health and rejects unknown routes", async () => {
    const { env } = workerEnv();
    const health = await worker.fetch(
      new Request("https://ai-review.test/health"),
      env,
    );
    await expect(health.json()).resolves.toMatchObject({
      ok: true,
      service: "ai-review",
      enabled: false,
      bindings: {
        durableObject: true,
        r2: true,
        workflow: true,
      },
    });
    expect(health.headers.get("cache-control")).toBe("no-store");

    const missing = await worker.fetch(
      new Request("https://ai-review.test/missing"),
      env,
    );
    expect(missing.status).toBe(404);
  });

  it("reports degraded health when a critical binding is absent", async () => {
    const { env } = workerEnv();
    Object.assign(env, { PR_STATE: undefined });

    const health = await worker.fetch(
      new Request("https://ai-review.test/health"),
      env,
    );

    expect(health.status).toBe(503);
    await expect(health.json()).resolves.toMatchObject({
      ok: false,
      bindings: { durableObject: false },
    });
  });

  it("rejects invalid signatures and disallowed repositories", async () => {
    const { env } = workerEnv();
    const invalid = await worker.fetch(
      new Request("https://ai-review.test/webhooks/github", {
        method: "POST",
        body: validBody,
      }),
      env,
    );
    expect(invalid.status).toBe(401);

    const disallowedBody = validBody.replace(
      "Robbie-Palmer/personal-site",
      "Robbie-Palmer/other",
    );
    const disallowed = await worker.fetch(
      signedWebhookRequest(disallowedBody, secret),
      env,
    );
    expect(disallowed.status).toBe(403);

    env.AI_REVIEW_REPOSITORY = "";
    const unconfigured = await worker.fetch(
      signedWebhookRequest(validBody, secret),
      env,
    );
    expect(unconfigured.status).toBe(403);
  });

  it("rejects malformed signed JSON without throwing", async () => {
    const { env } = workerEnv();

    const response = await worker.fetch(signedWebhookRequest("{", secret), env);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Malformed JSON payload",
    });

    const invalidPayload = JSON.stringify({
      action: "opened",
      repository: { full_name: "Robbie-Palmer/personal-site" },
    });
    const invalid = await worker.fetch(
      signedWebhookRequest(invalidPayload, secret),
      env,
    );
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({
      error: "Malformed webhook payload",
    });
  });

  it("rejects oversized webhook payloads before verification", async () => {
    const { env } = workerEnv();

    const declaredOversizeResponse = await worker.fetch(
      new Request("https://ai-review.test/webhooks/github", {
        method: "POST",
        body: "{}",
        headers: { "content-length": String(2 * 1024 * 1024 + 1) },
      }),
      env,
    );

    expect(declaredOversizeResponse.status).toBe(413);

    const actualOversizeResponse = await worker.fetch(
      new Request("https://ai-review.test/webhooks/github", {
        method: "POST",
        body: "x".repeat(2 * 1024 * 1024 + 1),
      }),
      env,
    );

    expect(actualOversizeResponse.status).toBe(413);
  });

  it("rejects signed webhooks missing routing headers", async () => {
    const { env } = workerEnv();

    const missingEvent = await worker.fetch(
      signedWebhookRequest(validBody, secret, { "x-github-event": "" }),
      env,
    );
    const missingDelivery = await worker.fetch(
      signedWebhookRequest(validBody, secret, { "x-github-delivery": "" }),
      env,
    );

    expect(missingEvent.status).toBe(400);
    expect(missingDelivery.status).toBe(400);
  });

  it("ignores unsupported events and forwards accepted events", async () => {
    const { env, fetch } = workerEnv();
    const ignored = await worker.fetch(
      signedWebhookRequest(validBody, secret, {
        "x-github-event": "push",
      }),
      env,
    );
    expect(ignored.status).toBe(202);

    const accepted = await worker.fetch(
      signedWebhookRequest(validBody, secret),
      env,
    );
    await expect(accepted.json()).resolves.toEqual({ accepted: true });
    expect(fetch).toHaveBeenCalledWith(
      "https://coordinator.internal/events",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sanitizes coordinator failures", async () => {
    const { env, fetch } = workerEnv();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    fetch.mockResolvedValueOnce(
      new Response("SQLite internals", { status: 500 }),
    );
    const rejected = await worker.fetch(
      signedWebhookRequest(validBody, secret),
      env,
    );
    expect(rejected.status).toBe(503);
    await expect(rejected.json()).resolves.toEqual({
      error: "Coordinator unavailable",
    });

    fetch.mockResolvedValueOnce(new Response("invalid", { status: 400 }));
    const invalid = await worker.fetch(
      signedWebhookRequest(validBody, secret),
      env,
    );
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({
      error: "Invalid coordinator request",
    });

    fetch.mockRejectedValueOnce(new Error("internal binding details"));
    const failed = await worker.fetch(
      signedWebhookRequest(validBody, secret),
      env,
    );
    expect(failed.status).toBe(503);
    expect(consoleError).toHaveBeenCalledTimes(3);
  });
});
