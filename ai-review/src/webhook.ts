import type { ReviewWorkflowParams } from "./env";

const encoder = new TextEncoder();
const REVIEW_RELEVANT_PULL_REQUEST_ACTIONS = new Set([
  "opened",
  "synchronize",
  "reopened",
  "ready_for_review",
]);
const REVIEW_ACTIVITY_EVENTS = new Set([
  "issue_comment",
  "pull_request_review",
  "pull_request_review_comment",
  "pull_request_review_thread",
]);

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |=
      (left.codePointAt(index) ?? 0) ^ (right.codePointAt(index) ?? 0);
  }
  return difference === 0;
}

export async function verifyGitHubSignature(
  body: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature?.startsWith("sha256=")) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return constantTimeEqual(signature, `sha256=${toHex(digest)}`);
}

type GitHubWebhook = {
  action?: unknown;
  repository?: {
    full_name?: unknown;
  };
  pull_request?: {
    number?: unknown;
    head?: {
      sha?: unknown;
    };
  };
  issue?: {
    number?: unknown;
    pull_request?: unknown;
  };
};

type WebhookIdentity = Pick<
  ReviewWorkflowParams,
  "deliveryId" | "eventName" | "action" | "repository"
>;

function parsePullRequestEvent(
  event: GitHubWebhook,
  identity: WebhookIdentity,
): ReviewWorkflowParams | null {
  if (!REVIEW_RELEVANT_PULL_REQUEST_ACTIONS.has(identity.action)) {
    return null;
  }
  const pullRequestNumber = event.pull_request?.number;
  if (typeof pullRequestNumber !== "number") {
    return null;
  }
  const headSha = event.pull_request?.head?.sha;
  return {
    ...identity,
    pullRequestNumber,
    ...(typeof headSha === "string" ? { headSha } : {}),
  };
}

function reviewActivityPullRequestNumber(
  eventName: string,
  event: GitHubWebhook,
): unknown {
  if (eventName === "issue_comment") {
    return event.issue?.pull_request ? event.issue.number : undefined;
  }
  return event.pull_request?.number;
}

export function parseReviewEvent(
  eventName: string,
  deliveryId: string,
  body: unknown,
): ReviewWorkflowParams | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const event = body as GitHubWebhook;
  const repository = event.repository?.full_name;
  const action = event.action;
  if (
    typeof repository !== "string" ||
    typeof action !== "string" ||
    deliveryId.length === 0
  ) {
    return null;
  }

  const identity = { deliveryId, eventName, action, repository };
  if (eventName === "pull_request") {
    return parsePullRequestEvent(event, identity);
  }

  if (!REVIEW_ACTIVITY_EVENTS.has(eventName)) {
    return null;
  }
  const pullRequestNumber = reviewActivityPullRequestNumber(eventName, event);
  if (typeof pullRequestNumber !== "number") {
    return null;
  }
  return { ...identity, pullRequestNumber };
}
