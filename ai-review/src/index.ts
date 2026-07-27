import {
  DurableObject,
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import type { Env, ReviewWorkflowParams } from "./env";
import { parseReviewEvent, verifyGitHubSignature } from "./webhook";

const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
};
const CREATE_WEBHOOK_DELIVERIES_TABLE =
  "CREATE TABLE IF NOT EXISTS webhook_deliveries (" +
  "delivery_id TEXT PRIMARY KEY, " +
  "event_name TEXT NOT NULL, " +
  "action TEXT NOT NULL, " +
  "repository TEXT NOT NULL, " +
  "pull_request_number INTEGER NOT NULL, " +
  "head_sha TEXT, " +
  "received_at TEXT NOT NULL)";
const DEFAULT_DEBOUNCE_DELAY_MS = 120_000;
const MINIMUM_DEBOUNCE_DELAY_MS = 1_000;
const MAXIMUM_DEBOUNCE_DELAY_MS = 3_600_000;
const PENDING_EVENT_KEY = "latest-pending-event";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: JSON_HEADERS });
}

function coordinatorName(event: ReviewWorkflowParams): string {
  return `${event.repository}#${event.pullRequestNumber}`;
}

function isReviewWorkflowParams(value: unknown): value is ReviewWorkflowParams {
  if (!value || typeof value !== "object") {
    return false;
  }
  const event = value as Partial<ReviewWorkflowParams>;
  return (
    typeof event.deliveryId === "string" &&
    event.deliveryId.length > 0 &&
    typeof event.eventName === "string" &&
    event.eventName.length > 0 &&
    typeof event.action === "string" &&
    event.action.length > 0 &&
    typeof event.repository === "string" &&
    event.repository.length > 0 &&
    typeof event.pullRequestNumber === "number" &&
    Number.isSafeInteger(event.pullRequestNumber) &&
    event.pullRequestNumber > 0 &&
    (event.headSha === undefined ||
      (typeof event.headSha === "string" && event.headSha.length > 0))
  );
}

function debounceDelayMs(rawSeconds: string): number {
  const seconds = Number(rawSeconds);
  if (!Number.isFinite(seconds)) {
    return DEFAULT_DEBOUNCE_DELAY_MS;
  }
  return Math.min(
    MAXIMUM_DEBOUNCE_DELAY_MS,
    Math.max(MINIMUM_DEBOUNCE_DELAY_MS, seconds * 1_000),
  );
}

function bindingHealth(env: Env) {
  return {
    ai: env.AI !== undefined,
    durableObject: env.PR_STATE !== undefined,
    r2: env.REVIEW_DATA !== undefined,
    workflow: env.REVIEW_WORKFLOW !== undefined,
  };
}

export class PullRequestCoordinator extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(CREATE_WEBHOOK_DELIVERIES_TABLE);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let event: unknown;
    try {
      event = await request.json();
    } catch {
      return json({ error: "Invalid coordinator event" }, 400);
    }
    if (!isReviewWorkflowParams(event)) {
      return json({ error: "Invalid coordinator event" }, 400);
    }
    const existing = this.ctx.storage.sql
      .exec<{ delivery_id: string }>(
        "SELECT delivery_id FROM webhook_deliveries WHERE delivery_id = ?",
        event.deliveryId,
      )
      .toArray();
    if (existing.length > 0) {
      return json({ accepted: true, duplicate: true });
    }

    this.ctx.storage.sql.exec(
      `INSERT INTO webhook_deliveries
        (delivery_id, event_name, action, repository, pull_request_number, head_sha, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      event.deliveryId,
      event.eventName,
      event.action,
      event.repository,
      event.pullRequestNumber,
      event.headSha ?? null,
      new Date().toISOString(),
    );
    // The coordinator reviews current PR state, so rapid deliveries deliberately
    // coalesce to the latest trigger rather than enqueueing redundant runs.
    await this.ctx.storage.put(PENDING_EVENT_KEY, event);

    if (this.env.AI_REVIEW_ENABLED === "true") {
      const delayMs = debounceDelayMs(this.env.AI_REVIEW_DEBOUNCE_SECONDS);
      // Resetting the alarm creates the ADR's trailing-edge quiet period.
      await this.ctx.storage.setAlarm(Date.now() + delayMs);
    }

    return json({
      accepted: true,
      enabled: this.env.AI_REVIEW_ENABLED === "true",
    });
  }

  override async alarm(): Promise<void> {
    const event =
      await this.ctx.storage.get<ReviewWorkflowParams>(PENDING_EVENT_KEY);
    if (!event || this.env.AI_REVIEW_ENABLED !== "true") {
      return;
    }

    const instanceId = `review-${event.deliveryId}`;
    await this.env.REVIEW_WORKFLOW.createBatch([
      {
        id: instanceId,
        params: event,
      },
    ]);
    await this.ctx.storage.delete(PENDING_EVENT_KEY);
  }
}

export class ReviewWorkflow extends WorkflowEntrypoint<
  Env,
  ReviewWorkflowParams
> {
  override async run(
    event: WorkflowEvent<ReviewWorkflowParams>,
    step: WorkflowStep,
  ): Promise<void> {
    await step.do("record-bootstrap-run", async () => {
      const key = [
        "v1",
        event.payload.repository,
        `pr-${event.payload.pullRequestNumber}`,
        `${event.timestamp.toISOString()}-${event.instanceId}.json`,
      ].join("/");
      await this.env.REVIEW_DATA.put(
        key,
        JSON.stringify({
          schemaVersion: 1,
          status: "bootstrap-only",
          promptVersion: this.env.AI_REVIEW_PROMPT_VERSION,
          model: this.env.AI_REVIEW_SCOUT_MODEL,
          event: event.payload,
          workflow: {
            instanceId: event.instanceId,
            timestamp: event.timestamp.toISOString(),
          },
        }),
        {
          httpMetadata: { contentType: "application/json" },
        },
      );
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      const bindings = bindingHealth(env);
      const ok = Object.values(bindings).every(Boolean);
      return json(
        {
          ok,
          service: "ai-review",
          enabled: env.AI_REVIEW_ENABLED === "true",
          bindings,
        },
        ok ? 200 : 503,
      );
    }

    if (request.method !== "POST" || url.pathname !== "/webhooks/github") {
      return new Response("Not found", { status: 404 });
    }

    const body = await request.text();
    const verified = await verifyGitHubSignature(
      body,
      request.headers.get("x-hub-signature-256"),
      env.AI_REVIEW_WEBHOOK_SECRET,
    );
    if (!verified) {
      return json({ error: "Invalid webhook signature" }, 401);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(body) as unknown;
    } catch {
      return json({ error: "Malformed JSON payload" }, 400);
    }

    const parsed = parseReviewEvent(
      request.headers.get("x-github-event") ?? "",
      request.headers.get("x-github-delivery") ?? "",
      payload,
    );
    if (parsed.kind === "ignored") {
      return json({ ignored: true, reason: parsed.reason }, 202);
    }
    if (parsed.kind === "invalid") {
      return json({ error: parsed.reason }, 400);
    }
    const event = parsed.event;
    const allowedRepository = env.AI_REVIEW_REPOSITORY?.trim().toLowerCase();
    if (
      !allowedRepository ||
      event.repository.trim().toLowerCase() !== allowedRepository
    ) {
      return json({ error: "Repository is not allowed" }, 403);
    }

    const id = env.PR_STATE.idFromName(coordinatorName(event));
    try {
      const response = await env.PR_STATE.get(id).fetch(
        "https://coordinator.internal/events",
        {
          method: "POST",
          body: JSON.stringify(event),
        },
      );
      if (!response.ok) {
        console.error("Coordinator rejected a validated webhook", {
          status: response.status,
        });
        return json({ error: "Coordinator unavailable" }, 503);
      }
      return response;
    } catch (error) {
      console.error("Coordinator request failed", error);
      return json({ error: "Coordinator unavailable" }, 503);
    }
  },
} satisfies ExportedHandler<Env>;
