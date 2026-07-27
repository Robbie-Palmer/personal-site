import {
  DurableObject,
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import type { Env, ReviewWorkflowParams } from "./env";
import { parseReviewEvent, verifyGitHubSignature } from "./webhook";

const JSON_HEADERS = {
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

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: JSON_HEADERS });
}

function coordinatorName(event: ReviewWorkflowParams): string {
  return `${event.repository}#${event.pullRequestNumber}`;
}

function debounceDelayMs(rawSeconds: string): number {
  const seconds = Number(rawSeconds);
  if (!Number.isFinite(seconds)) {
    return DEFAULT_DEBOUNCE_DELAY_MS;
  }
  return Math.max(MINIMUM_DEBOUNCE_DELAY_MS, seconds * 1_000);
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

    const event = await request.json<ReviewWorkflowParams>();
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
    await this.ctx.storage.put("pending-event", event);

    if (this.env.AI_REVIEW_ENABLED === "true") {
      const delayMs = debounceDelayMs(this.env.AI_REVIEW_DEBOUNCE_SECONDS);
      await this.ctx.storage.setAlarm(Date.now() + delayMs);
    }

    return json({
      accepted: true,
      enabled: this.env.AI_REVIEW_ENABLED === "true",
    });
  }

  override async alarm(): Promise<void> {
    const event =
      await this.ctx.storage.get<ReviewWorkflowParams>("pending-event");
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
    await this.ctx.storage.delete("pending-event");
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

    const event = parseReviewEvent(
      request.headers.get("x-github-event") ?? "",
      request.headers.get("x-github-delivery") ?? "",
      JSON.parse(body) as unknown,
    );
    if (!event) {
      return json({ ignored: true, reason: "unsupported-event" }, 202);
    }
    if (
      event.repository.toLowerCase() !== env.AI_REVIEW_REPOSITORY.toLowerCase()
    ) {
      return json({ error: "Repository is not allowed" }, 403);
    }

    const id = env.PR_STATE.idFromName(coordinatorName(event));
    return env.PR_STATE.get(id).fetch("https://coordinator.internal/events", {
      method: "POST",
      body: JSON.stringify(event),
    });
  },
} satisfies ExportedHandler<Env>;
