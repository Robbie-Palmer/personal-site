import {
  DurableObject,
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import type { Env, ReviewWorkflowParams } from "./env";
import {
  claimReview,
  completeReview,
  failReview,
  mergeFindings,
  prepareReview,
  publishReview,
  recordReview,
  runScouts,
  type MergedRun,
  type ScoutRun,
} from "./review-engine";
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
const CREATE_REVIEW_RUNS_TABLE =
  "CREATE TABLE IF NOT EXISTS review_runs (" +
  "run_id TEXT PRIMARY KEY, " +
  "head_sha TEXT NOT NULL, " +
  "diff_fingerprint TEXT NOT NULL, " +
  "config_fingerprint TEXT NOT NULL, " +
  "status TEXT NOT NULL, " +
  "force_run INTEGER NOT NULL, " +
  "started_at TEXT NOT NULL, " +
  "completed_at TEXT, " +
  "cost_usd REAL NOT NULL DEFAULT 0, " +
  "comment_id INTEGER, " +
  "findings_json TEXT, " +
  "error TEXT)";
const DEFAULT_DEBOUNCE_DELAY_MS = 120_000;
const MINIMUM_DEBOUNCE_DELAY_MS = 1_000;
const MAXIMUM_DEBOUNCE_DELAY_MS = 3_600_000;
const COORDINATOR_TIMEOUT_MS = 10_000;
const MAXIMUM_WEBHOOK_BODY_BYTES = 2 * 1024 * 1024;
const PENDING_EVENT_KEY = "latest-pending-event";
const textEncoder = new TextEncoder();

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
    typeof event.force === "boolean" &&
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
    durableObject: env.PR_STATE !== undefined,
    r2: env.REVIEW_DATA !== undefined,
    workflow: env.REVIEW_WORKFLOW !== undefined,
  };
}

function healthResponse(env: Env): Response {
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

async function readWebhookBody(
  request: Request,
): Promise<{ body: string } | { response: Response }> {
  const declaredBodyBytes = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredBodyBytes) &&
    declaredBodyBytes > MAXIMUM_WEBHOOK_BODY_BYTES
  ) {
    return { response: json({ error: "Webhook payload is too large" }, 413) };
  }

  const body = await request.text();
  if (textEncoder.encode(body).byteLength > MAXIMUM_WEBHOOK_BODY_BYTES) {
    return { response: json({ error: "Webhook payload is too large" }, 413) };
  }
  return { body };
}

async function forwardToCoordinator(
  event: ReviewWorkflowParams,
  env: Env,
): Promise<Response> {
  const id = env.PR_STATE.idFromName(coordinatorName(event));
  try {
    // This fixed URL is the standard Durable Object stub-fetch target; the
    // validated event body contains all provenance the coordinator needs.
    const response = await env.PR_STATE.get(id).fetch(
      "https://coordinator.internal/events",
      {
        method: "POST",
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(COORDINATOR_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      console.error("Coordinator rejected a validated webhook", {
        status: response.status,
      });
      if (response.status >= 400 && response.status < 500) {
        return json({ error: "Invalid coordinator request" }, 400);
      }
      return json({ error: "Coordinator unavailable" }, 503);
    }
    return response;
  } catch (error) {
    console.error(
      "Coordinator request failed",
      error instanceof Error ? { name: error.name } : { type: typeof error },
    );
    return json({ error: "Coordinator unavailable" }, 503);
  }
}

export class PullRequestCoordinator extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(CREATE_WEBHOOK_DELIVERIES_TABLE);
    this.ctx.storage.sql.exec(CREATE_REVIEW_RUNS_TABLE);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    const path = new URL(request.url).pathname;
    if (path === "/events") return this.receiveEvent(request);
    if (path === "/reviews/claim") return this.claimReview(request);
    if (path === "/reviews/complete") return this.completeReview(request);
    if (path === "/reviews/fail") return this.failReview(request);
    return new Response("Not found", { status: 404 });
  }

  private async receiveEvent(request: Request): Promise<Response> {
    let event: unknown;
    try {
      event = await request.json();
    } catch {
      return json({ error: "Invalid coordinator event" }, 400);
    }
    if (!isReviewWorkflowParams(event)) {
      return json({ error: "Invalid coordinator event" }, 400);
    }
    const pending =
      await this.ctx.storage.get<ReviewWorkflowParams>(PENDING_EVENT_KEY);
    const coalesced = pending?.force ? { ...event, force: true } : event;
    const inserted = this.ctx.storage.transactionSync(() => {
      const existing = this.ctx.storage.sql
        .exec<{ delivery_id: string }>(
          "SELECT delivery_id FROM webhook_deliveries WHERE delivery_id = ?",
          event.deliveryId,
        )
        .toArray();
      if (existing.length > 0) {
        return false;
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
      this.ctx.storage.kv.put(PENDING_EVENT_KEY, coalesced);
      return true;
    });

    if (this.env.AI_REVIEW_ENABLED === "true" && inserted) {
      const delayMs = debounceDelayMs(this.env.AI_REVIEW_DEBOUNCE_SECONDS);
      // Resetting the alarm creates the ADR's trailing-edge quiet period.
      await this.ctx.storage.setAlarm(Date.now() + delayMs);
    }
    if (!inserted) {
      // A retry after a failed alarm write must restore the alarm, but a
      // duplicate must not extend an alarm that is already scheduled.
      if (
        this.env.AI_REVIEW_ENABLED === "true" &&
        (await this.ctx.storage.getAlarm()) === null
      ) {
        const delayMs = debounceDelayMs(this.env.AI_REVIEW_DEBOUNCE_SECONDS);
        await this.ctx.storage.setAlarm(Date.now() + delayMs);
      }
      return json({ accepted: true, duplicate: true });
    }

    return json({
      accepted: true,
      enabled: this.env.AI_REVIEW_ENABLED === "true",
    });
  }

  private async claimReview(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => null)) as {
      runId?: unknown;
      headSha?: unknown;
      diffFingerprint?: unknown;
      configFingerprint?: unknown;
      force?: unknown;
      maxRuns?: unknown;
      maxCostUsd?: unknown;
    } | null;
    if (
      !body ||
      typeof body.runId !== "string" ||
      typeof body.headSha !== "string" ||
      typeof body.diffFingerprint !== "string" ||
      typeof body.configFingerprint !== "string" ||
      typeof body.force !== "boolean" ||
      typeof body.maxRuns !== "number" ||
      !Number.isFinite(body.maxRuns) ||
      typeof body.maxCostUsd !== "number" ||
      !Number.isFinite(body.maxCostUsd)
    ) {
      return json({ error: "Invalid review claim" }, 400);
    }
    const maxRuns = body.maxRuns;
    const maxCostUsd = body.maxCostUsd;

    const result = this.ctx.storage.transactionSync(() => {
      const aggregate = this.ctx.storage.sql
        .exec<{ attempts: number; runs: number; total_cost: number }>(
          `SELECT COUNT(*) AS attempts,
                  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS runs,
                  COALESCE(SUM(cost_usd), 0) AS total_cost
           FROM review_runs`,
        )
        .toArray()[0] ?? { attempts: 0, runs: 0, total_cost: 0 };
      const previousState = {
        runs: Number(aggregate.runs),
        total_usd: Number(aggregate.total_cost),
      };
      const existingRun = this.ctx.storage.sql
        .exec<{ status: string }>(
          "SELECT status FROM review_runs WHERE run_id = ?",
          body.runId,
        )
        .toArray()[0];
      if (existingRun) {
        return {
          claimed: existingRun.status !== "completed",
          reason:
            existingRun.status === "completed"
              ? "workflow instance already completed"
              : undefined,
          previousState,
        };
      }
      const active = this.ctx.storage.sql
        .exec<{ run_id: string }>(
          `SELECT run_id FROM review_runs
           WHERE head_sha = ? AND config_fingerprint = ? AND status = 'running'
           LIMIT 1`,
          body.headSha,
          body.configFingerprint,
        )
        .toArray()[0];
      if (active) {
        return {
          claimed: false,
          reason: "an equivalent review is already running",
          previousState,
        };
      }
      if (!body.force) {
        const completed = this.ctx.storage.sql
          .exec<{ run_id: string }>(
            `SELECT run_id FROM review_runs
             WHERE diff_fingerprint = ? AND config_fingerprint = ?
               AND status = 'completed'
             LIMIT 1`,
            body.diffFingerprint,
            body.configFingerprint,
          )
          .toArray()[0];
        if (completed) {
          return {
            claimed: false,
            reason: "this content and reviewer configuration were already reviewed",
            previousState,
          };
        }
      }
      if (Number(aggregate.attempts) >= maxRuns) {
        return {
          claimed: false,
          reason: "per-PR review-run budget reached",
          previousState,
        };
      }
      if (previousState.total_usd >= maxCostUsd) {
        return {
          claimed: false,
          reason: "per-PR cost budget reached",
          previousState,
        };
      }
      this.ctx.storage.sql.exec(
        `INSERT INTO review_runs
         (run_id, head_sha, diff_fingerprint, config_fingerprint, status,
          force_run, started_at)
         VALUES (?, ?, ?, ?, 'running', ?, ?)`,
        body.runId,
        body.headSha,
        body.diffFingerprint,
        body.configFingerprint,
        body.force ? 1 : 0,
        new Date().toISOString(),
      );
      return { claimed: true, previousState };
    });
    return json(result);
  }

  private async completeReview(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => null)) as {
      runId?: unknown;
      headSha?: unknown;
      costUsd?: unknown;
      commentId?: unknown;
      findings?: unknown;
    } | null;
    if (
      !body ||
      typeof body.runId !== "string" ||
      typeof body.headSha !== "string" ||
      typeof body.costUsd !== "number" ||
      !Number.isFinite(body.costUsd) ||
      body.costUsd < 0 ||
      (body.commentId !== undefined && typeof body.commentId !== "number") ||
      !Array.isArray(body.findings)
    ) {
      return json({ error: "Invalid review completion" }, 400);
    }
    this.ctx.storage.sql.exec(
      `UPDATE review_runs
       SET status = 'completed', completed_at = ?, cost_usd = ?,
           comment_id = ?, findings_json = ?, error = NULL
       WHERE run_id = ? AND head_sha = ?`,
      new Date().toISOString(),
      body.costUsd,
      body.commentId ?? null,
      JSON.stringify(body.findings),
      body.runId,
      body.headSha,
    );
    return json({ completed: true });
  }

  private async failReview(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => null)) as {
      runId?: unknown;
      error?: unknown;
      costUsd?: unknown;
    } | null;
    if (
      !body ||
      typeof body.runId !== "string" ||
      typeof body.error !== "string" ||
      typeof body.costUsd !== "number" ||
      !Number.isFinite(body.costUsd) ||
      body.costUsd < 0
    ) {
      return json({ error: "Invalid review failure" }, 400);
    }
    this.ctx.storage.sql.exec(
      `UPDATE review_runs
       SET status = 'failed', completed_at = ?, error = ?, cost_usd = ?
       WHERE run_id = ? AND status != 'completed'`,
      new Date().toISOString(),
      body.error.slice(0, 500),
      body.costUsd,
      body.runId,
    );
    return json({ failed: true });
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
    // Delete only after Workflow confirms creation. If creation throws, the
    // platform retries the alarm and the delivery-derived ID is idempotent.
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
    const workflowStep = step as unknown as {
      do<T>(name: string, operation: () => Promise<T>): Promise<T>;
    };
    let incurredCostUsd = 0;
    try {
      const prepared = await workflowStep.do("prepare-review", () =>
        prepareReview(this.env, event.payload),
      );
      if (prepared.skipReason) {
        console.log("Skipping stateful AI review", {
          repository: event.payload.repository,
          pullRequestNumber: event.payload.pullRequestNumber,
          reason: prepared.skipReason,
        });
        return;
      }
      const claim = await workflowStep.do("claim-review", () =>
        claimReview(this.env, event.payload, event.instanceId, prepared),
      );
      if (!claim.claimed) {
        console.log("Skipping duplicate or over-budget AI review", {
          repository: event.payload.repository,
          pullRequestNumber: event.payload.pullRequestNumber,
          reason: claim.reason,
        });
        return;
      }

      let scouts: ScoutRun;
      let merged: MergedRun;
      if (prepared.diff?.trim()) {
        scouts = await workflowStep.do("run-current-scout-ensemble", () =>
          runScouts(this.env, event.payload, prepared),
        );
        incurredCostUsd = Object.values(scouts.costs).reduce(
          (total, cost) => total + cost,
          0,
        );
        merged = await workflowStep.do("merge-current-scout-findings", () =>
          mergeFindings(this.env, event.payload, prepared, scouts),
        );
        incurredCostUsd += merged.cost;
      } else {
        scouts = {
          models: [],
          candidates: {},
          failed: [],
          candidateCounts: {},
          invalidCounts: {},
          outOfScopeCounts: {},
          costs: {},
          metrics: [],
        };
        merged = {
          result: {
            summary: "No reviewable text changes found.",
            findings: [],
          },
          cost: 0,
        };
      }
      const publication = await workflowStep.do("publish-rolling-comment", () =>
        publishReview(
          this.env,
          event.payload,
          prepared,
          scouts,
          merged,
          claim.previousState,
        ),
      );
      await workflowStep.do("record-versioned-review", () =>
        recordReview(
          this.env,
          event.payload,
          event.instanceId,
          prepared,
          scouts,
          merged,
          publication,
          event.timestamp,
        ),
      );
      await workflowStep.do("complete-review-state", () =>
        completeReview(
          this.env,
          event.payload,
          event.instanceId,
          prepared,
          merged,
          publication,
        ),
      );
    } catch (error) {
      try {
        await failReview(
          this.env,
          event.payload,
          event.instanceId,
          error,
          incurredCostUsd,
        );
      } catch (stateError) {
        console.error("Could not record failed review state", {
          type:
            stateError instanceof Error ? stateError.name : typeof stateError,
        });
      }
      throw error;
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return healthResponse(env);
    }

    if (request.method !== "POST" || url.pathname !== "/webhooks/github") {
      return new Response("Not found", { status: 404 });
    }

    const bodyResult = await readWebhookBody(request);
    if ("response" in bodyResult) {
      return bodyResult.response;
    }
    const { body } = bodyResult;
    const eventName = request.headers.get("x-github-event");
    const deliveryId = request.headers.get("x-github-delivery");
    const verified = await verifyGitHubSignature(
      body,
      request.headers.get("x-hub-signature-256"),
      env.AI_REVIEW_WEBHOOK_SECRET,
    );
    if (!verified) {
      return json({ error: "Invalid webhook signature" }, 401);
    }
    if (!eventName || !deliveryId) {
      return json({ error: "Missing GitHub webhook headers" }, 400);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(body) as unknown;
    } catch {
      return json({ error: "Malformed JSON payload" }, 400);
    }

    const parsed = parseReviewEvent(eventName, deliveryId, payload);
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

    return forwardToCoordinator(event, env);
  },
} satisfies ExportedHandler<Env>;
