import { createHmac } from "node:crypto";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env, ReviewWorkflowParams } from "../src/env";
import worker, {
  PullRequestCoordinator,
  ReviewWorkflow,
} from "../src/index";

const event: ReviewWorkflowParams = {
  deliveryId: "delivery-123",
  eventName: "pull_request",
  action: "synchronize",
  repository: "Robbie-Palmer/personal-site",
  pullRequestNumber: 821,
  headSha: "abcdef123456",
};

function coordinatorFixture(existingDeliveries: string[] = []) {
  const sqlExec = vi.fn((query: string) => ({
    toArray: () =>
      query.startsWith("SELECT") &&
      existingDeliveries.includes(event.deliveryId)
        ? [{ delivery_id: event.deliveryId }]
        : [],
  }));
  const storage = {
    sql: { exec: sqlExec },
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    setAlarm: vi.fn(),
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
    expect(storage.put).toHaveBeenCalledWith("pending-event", event);
    expect(storage.setAlarm).toHaveBeenCalledOnce();
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
    expect(storage.put).not.toHaveBeenCalled();

    const rejected = await coordinator.fetch(
      new Request("https://coordinator.test/events"),
    );
    expect(rejected.status).toBe(405);
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
    expect(storage.delete).toHaveBeenCalledWith("pending-event");
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
});

describe("ReviewWorkflow", () => {
  it("records a versioned bootstrap result", async () => {
    const put = vi.fn();
    const env = {
      REVIEW_DATA: { put },
      AI_REVIEW_DATA_RETENTION_DAYS: "365",
      AI_REVIEW_PROMPT_VERSION: "adr-056-v1",
      AI_REVIEW_SCOUT_MODEL: "@cf/meta/llama-3.2-3b-instruct",
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

    expect(put).toHaveBeenCalledOnce();
    expect(put.mock.calls[0]?.[0]).toContain(
      "v1/Robbie-Palmer/personal-site/pr-821/",
    );
    expect(JSON.parse(String(put.mock.calls[0]?.[1]))).toMatchObject({
      status: "bootstrap-only",
      event,
    });
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
    });

    const missing = await worker.fetch(
      new Request("https://ai-review.test/missing"),
      env,
    );
    expect(missing.status).toBe(404);
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
});
