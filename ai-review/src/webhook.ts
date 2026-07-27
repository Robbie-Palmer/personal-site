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

function hexBytes(value: string): Uint8Array | null {
  if (!/^[\da-f]{64}$/i.test(value)) {
    return null;
  }

  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

export async function verifyGitHubSignature(
  body: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature?.startsWith("sha256=")) {
    return false;
  }
  const signatureBytes = hexBytes(signature.slice("sha256=".length));
  if (!signatureBytes) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(body),
  );
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

export type ReviewEventParseResult =
  | { kind: "accepted"; event: ReviewWorkflowParams }
  | { kind: "ignored"; reason: "unsupported-event" }
  | { kind: "invalid"; reason: "Malformed webhook payload" };

function parsePullRequestEvent(
  event: GitHubWebhook,
  identity: WebhookIdentity,
): ReviewEventParseResult {
  if (!REVIEW_RELEVANT_PULL_REQUEST_ACTIONS.has(identity.action)) {
    return { kind: "ignored", reason: "unsupported-event" };
  }
  const pullRequestNumber = event.pull_request?.number;
  const headSha = event.pull_request?.head?.sha;
  if (
    typeof pullRequestNumber !== "number" ||
    !Number.isSafeInteger(pullRequestNumber) ||
    pullRequestNumber <= 0 ||
    typeof headSha !== "string" ||
    headSha.length === 0
  ) {
    return { kind: "invalid", reason: "Malformed webhook payload" };
  }
  return {
    kind: "accepted",
    event: {
      ...identity,
      pullRequestNumber,
      headSha,
    },
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
): ReviewEventParseResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { kind: "invalid", reason: "Malformed webhook payload" };
  }

  const event = body as GitHubWebhook;
  const repository = event.repository?.full_name;
  const action = event.action;
  if (
    typeof repository !== "string" ||
    repository.length === 0 ||
    typeof action !== "string" ||
    action.length === 0 ||
    deliveryId.length === 0
  ) {
    return { kind: "invalid", reason: "Malformed webhook payload" };
  }

  const identity = { deliveryId, eventName, action, repository };
  if (eventName === "pull_request") {
    return parsePullRequestEvent(event, identity);
  }

  if (!REVIEW_ACTIVITY_EVENTS.has(eventName)) {
    return { kind: "ignored", reason: "unsupported-event" };
  }
  if (eventName === "issue_comment") {
    const pullRequestMarker = event.issue?.pull_request;
    if (pullRequestMarker === undefined) {
      return { kind: "ignored", reason: "unsupported-event" };
    }
    if (
      !pullRequestMarker ||
      typeof pullRequestMarker !== "object" ||
      Array.isArray(pullRequestMarker)
    ) {
      return { kind: "invalid", reason: "Malformed webhook payload" };
    }
  }
  const pullRequestNumber = reviewActivityPullRequestNumber(eventName, event);
  if (
    typeof pullRequestNumber !== "number" ||
    !Number.isSafeInteger(pullRequestNumber) ||
    pullRequestNumber <= 0
  ) {
    return { kind: "invalid", reason: "Malformed webhook payload" };
  }
  return {
    kind: "accepted",
    event: { ...identity, pullRequestNumber },
  };
}
