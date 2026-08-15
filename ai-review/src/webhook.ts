import {
  TRUSTED_AUTHOR_ASSOCIATIONS,
  type FindingInteractionEvent,
  type PullRequestFinalizationEvent,
  type ReviewWorkflowParams,
} from "./env";

const encoder = new TextEncoder();
const REVIEW_RELEVANT_PULL_REQUEST_ACTIONS = new Set([
  "opened",
  "synchronize",
  "reopened",
  "ready_for_review",
]);
const REVIEW_COMMENT_ACTIONS = new Set(["created", "edited", "deleted"]);
const REVIEW_THREAD_ACTIONS = new Set(["resolved", "unresolved"]);
const MAX_DELIVERY_ID_LENGTH = 255;
const MAX_DISPOSITION_REASON_LENGTH = 1_000;
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
  number?: unknown;
  repository?: {
    full_name?: unknown;
  };
  updated_at?: unknown;
  pull_request?: {
    number?: unknown;
    merged?: unknown;
    closed_at?: unknown;
    author_association?: unknown;
    user?: { login?: unknown };
    head?: {
      sha?: unknown;
    };
  };
  issue?: {
    number?: unknown;
    pull_request?: unknown;
  };
  comment?: {
    id?: unknown;
    in_reply_to_id?: unknown;
    body?: unknown;
    author_association?: unknown;
    created_at?: unknown;
    updated_at?: unknown;
    reactions?: unknown;
    user?: { login?: unknown };
  };
  sender?: { login?: unknown };
  thread?: {
    node_id?: unknown;
    comments?: unknown;
  };
};

type WebhookIdentity = Pick<
  ReviewWorkflowParams,
  "deliveryId" | "eventName" | "action" | "repository"
>;
type FindingInteractionIdentity = Pick<
  FindingInteractionEvent,
  "deliveryId" | "eventName" | "action" | "repository"
>;

export type ReviewEventParseResult =
  | { kind: "accepted"; event: ReviewWorkflowParams }
  | { kind: "ignored"; reason: "unsupported-event" }
  | { kind: "invalid"; reason: "Malformed webhook payload" };

export type FindingInteractionParseResult =
  | { kind: "accepted"; event: FindingInteractionEvent }
  | { kind: "ignored"; reason: "unsupported-event" }
  | { kind: "invalid"; reason: "Malformed webhook payload" };

export type PullRequestFinalizationParseResult =
  | { kind: "accepted"; event: PullRequestFinalizationEvent }
  | { kind: "ignored"; reason: "unsupported-event" }
  | { kind: "invalid"; reason: "Malformed webhook payload" };

function findingDispositionCommand(body: string):
  | {
      disposition: "acknowledged" | "confirmed-fixed" | "rejected";
      findingId: string;
      reason: string;
    }
  | undefined {
  if (body !== body.trim() || !body.startsWith("/ai-review ")) {
    return undefined;
  }
  const actionStart = "/ai-review ".length;
  const actionEnd = body.indexOf(" ", actionStart);
  if (actionEnd < 0) return undefined;
  const action = body.slice(actionStart, actionEnd).toLowerCase();
  if (
    action !== "acknowledge" &&
    action !== "confirm-fixed" &&
    action !== "reject"
  ) {
    return undefined;
  }
  const findingStart = actionEnd + 1;
  const findingEnd = body.indexOf(" ", findingStart);
  if (findingEnd < 0) return undefined;
  const findingId = body.slice(findingStart, findingEnd).toLowerCase();
  if (!/^f_[a-f0-9]{24}$/.test(findingId)) return undefined;
  const reason = body.slice(findingEnd + 1).trim();
  if (!reason || reason.length > MAX_DISPOSITION_REASON_LENGTH) return undefined;
  return {
    disposition:
      action === "acknowledge"
        ? "acknowledged"
        : action === "confirm-fixed"
          ? "confirmed-fixed"
          : "rejected",
    findingId,
    reason,
  };
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
    ? value
    : undefined;
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function actorIsTrusted(event: GitHubWebhook, repository: string): boolean {
  const actor = event.sender?.login;
  if (typeof actor !== "string" || actor.length === 0) return false;
  const association = event.comment?.author_association;
  if (
    typeof association === "string" &&
    TRUSTED_AUTHOR_ASSOCIATIONS.has(association) &&
    typeof event.comment?.user?.login === "string" &&
    event.comment.user.login.toLowerCase() === actor.toLowerCase()
  ) {
    return true;
  }
  const [owner] = repository.split("/", 1);
  if (actor.toLowerCase() === owner?.toLowerCase()) return true;
  const pullRequestAuthor = event.pull_request?.user?.login;
  return (
    typeof pullRequestAuthor === "string" &&
    actor.toLowerCase() === pullRequestAuthor.toLowerCase() &&
    typeof event.pull_request?.author_association === "string" &&
    TRUSTED_AUTHOR_ASSOCIATIONS.has(event.pull_request.author_association)
  );
}

function reactionCounts(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const counts = Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, count]) =>
          key !== "url" &&
          typeof count === "number" &&
          Number.isSafeInteger(count) &&
          count >= 0,
      )
      .map(([key, count]) => [key, count as number]),
  );
  return Object.keys(counts).length > 0 ? counts : undefined;
}

function threadRootComment(
  thread: GitHubWebhook["thread"],
): { id: number; threadId: string; reactions?: Record<string, number> } | undefined {
  const threadId = thread?.node_id;
  if (typeof threadId !== "string" || threadId.length === 0) return undefined;
  if (!Array.isArray(thread?.comments)) return undefined;
  const root = thread.comments.find(
    (candidate) =>
      candidate !== null &&
      typeof candidate === "object" &&
      !Array.isArray(candidate) &&
      ((candidate as { in_reply_to_id?: unknown }).in_reply_to_id === null ||
        (candidate as { in_reply_to_id?: unknown }).in_reply_to_id === undefined),
  );
  if (!root) return undefined;
  const comment = root as { id?: unknown; reactions?: unknown };
  const id = positiveInteger(comment.id);
  return id
    ? { id, threadId, reactions: reactionCounts(comment.reactions) }
    : undefined;
}

function webhookActor(event: GitHubWebhook): string | undefined {
  const actor = event.sender?.login;
  return typeof actor === "string" && actor.length > 0 ? actor : undefined;
}

function commentTimestamp(comment: GitHubWebhook["comment"]): string | undefined {
  if (typeof comment?.updated_at === "string") return comment.updated_at;
  return typeof comment?.created_at === "string" ? comment.created_at : undefined;
}

function parseDispositionInteraction(
  event: GitHubWebhook,
  identity: FindingInteractionIdentity,
): FindingInteractionParseResult {
  const comment = event.comment;
  if (typeof comment?.body !== "string") {
    return { kind: "ignored", reason: "unsupported-event" };
  }
  const command = findingDispositionCommand(comment.body);
  if (!command) return { kind: "ignored", reason: "unsupported-event" };
  const pullRequestNumber = positiveInteger(event.issue?.number);
  if (!pullRequestNumber || event.issue?.pull_request === undefined) {
    return { kind: "invalid", reason: "Malformed webhook payload" };
  }
  const actor = webhookActor(event);
  if (!actor) return { kind: "invalid", reason: "Malformed webhook payload" };
  if (!actorIsTrusted(event, identity.repository)) {
    return { kind: "ignored", reason: "unsupported-event" };
  }
  const actorAssociation =
    typeof comment.author_association === "string"
      ? comment.author_association
      : undefined;
  return {
    kind: "accepted",
    event: {
      ...identity,
      pullRequestNumber,
      interactionType: "disposition",
      actor,
      actorAssociation,
      findingId: command.findingId,
      disposition: command.disposition,
      reason: command.reason,
      commentId: positiveInteger(comment.id),
      body: comment.body.slice(0, 4_000),
      occurredAt: commentTimestamp(comment),
    },
  };
}

function parseReplyInteraction(
  event: GitHubWebhook,
  identity: FindingInteractionIdentity,
): FindingInteractionParseResult {
  const comment = event.comment;
  const pullRequestNumber = positiveInteger(event.pull_request?.number);
  const rootCommentId = positiveInteger(comment?.in_reply_to_id);
  const commentId = positiveInteger(comment?.id);
  if (!pullRequestNumber || !rootCommentId || !commentId) {
    return { kind: "ignored", reason: "unsupported-event" };
  }
  const actor = webhookActor(event);
  if (!actor) return { kind: "invalid", reason: "Malformed webhook payload" };
  if (!actorIsTrusted(event, identity.repository)) {
    return { kind: "ignored", reason: "unsupported-event" };
  }
  return {
    kind: "accepted",
    event: {
      ...identity,
      pullRequestNumber,
      interactionType: "reply",
      actor,
      actorAssociation:
        typeof comment?.author_association === "string"
          ? comment.author_association
          : undefined,
      rootCommentId,
      commentId,
      body:
        typeof comment?.body === "string" ? comment.body.slice(0, 4_000) : undefined,
      reactions: reactionCounts(comment?.reactions),
      occurredAt: commentTimestamp(comment),
    },
  };
}

function parseThreadInteraction(
  event: GitHubWebhook,
  identity: FindingInteractionIdentity,
): FindingInteractionParseResult {
  const pullRequestNumber = positiveInteger(event.pull_request?.number);
  const rootComment = threadRootComment(event.thread);
  if (!pullRequestNumber || !rootComment) {
    return { kind: "invalid", reason: "Malformed webhook payload" };
  }
  const actor = webhookActor(event);
  if (!actor) return { kind: "invalid", reason: "Malformed webhook payload" };
  if (!actorIsTrusted(event, identity.repository)) {
    return { kind: "ignored", reason: "unsupported-event" };
  }
  return {
    kind: "accepted",
    event: {
      ...identity,
      pullRequestNumber,
      interactionType: "thread",
      actor,
      rootCommentId: rootComment.id,
      reactions: rootComment.reactions,
      threadId: rootComment.threadId,
      occurredAt:
        typeof event.updated_at === "string" ? event.updated_at : undefined,
    },
  };
}

export function parseFindingInteraction(
  eventName: string,
  deliveryId: string,
  body: unknown,
): FindingInteractionParseResult {
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
    deliveryId.length === 0 ||
    deliveryId.length > MAX_DELIVERY_ID_LENGTH
  ) {
    return { kind: "invalid", reason: "Malformed webhook payload" };
  }
  const identity = { deliveryId, eventName, action, repository };
  if (eventName === "issue_comment" && action === "created") {
    return parseDispositionInteraction(event, identity);
  }

  if (
    eventName === "pull_request_review_comment" &&
    REVIEW_COMMENT_ACTIONS.has(action)
  ) {
    return parseReplyInteraction(event, identity);
  }

  if (
    eventName === "pull_request_review_thread" &&
    REVIEW_THREAD_ACTIONS.has(action)
  ) {
    return parseThreadInteraction(event, identity);
  }

  return { kind: "ignored", reason: "unsupported-event" };
}

export function parsePullRequestFinalization(
  eventName: string,
  deliveryId: string,
  body: unknown,
): PullRequestFinalizationParseResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { kind: "invalid", reason: "Malformed webhook payload" };
  }
  const event = body as GitHubWebhook;
  if (eventName !== "pull_request" || event.action !== "closed") {
    return { kind: "ignored", reason: "unsupported-event" };
  }
  const repository = event.repository?.full_name;
  const pullRequestNumber = positiveInteger(event.number);
  const headSha = event.pull_request?.head?.sha;
  const occurredAt = event.pull_request?.closed_at;
  if (
    typeof repository !== "string" ||
    repository.length === 0 ||
    !pullRequestNumber ||
    typeof headSha !== "string" ||
    headSha.length === 0 ||
    typeof event.pull_request?.merged !== "boolean" ||
    (occurredAt !== undefined && !isIsoTimestamp(occurredAt)) ||
    deliveryId.length === 0 ||
    deliveryId.length > MAX_DELIVERY_ID_LENGTH
  ) {
    return { kind: "invalid", reason: "Malformed webhook payload" };
  }
  return {
    kind: "accepted",
    event: {
      deliveryId,
      eventName: "pull_request",
      action: "closed",
      repository,
      pullRequestNumber,
      headSha,
      finalState: event.pull_request.merged ? "merged" : "closed",
      occurredAt: typeof occurredAt === "string" ? occurredAt : undefined,
    },
  };
}

function parsePullRequestEvent(
  event: GitHubWebhook,
  identity: WebhookIdentity,
): ReviewEventParseResult {
  if (!REVIEW_RELEVANT_PULL_REQUEST_ACTIONS.has(identity.action)) {
    return { kind: "ignored", reason: "unsupported-event" };
  }
  const pullRequestNumber = event.number;
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
      force: false,
    },
  };
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
    deliveryId.length === 0 ||
    deliveryId.length > MAX_DELIVERY_ID_LENGTH
  ) {
    return { kind: "invalid", reason: "Malformed webhook payload" };
  }

  const identity = { deliveryId, eventName, action, repository };
  if (eventName === "pull_request") {
    return parsePullRequestEvent(event, identity);
  }

  const reviewCommand =
    typeof event.comment?.body === "string"
      ? /^\/ai-review(?: full)?$/.exec(event.comment.body)
      : null;
  if (
    eventName !== "issue_comment" ||
    identity.action !== "created" ||
    !reviewCommand ||
    typeof event.comment?.author_association !== "string" ||
    !TRUSTED_AUTHOR_ASSOCIATIONS.has(event.comment.author_association) ||
    typeof event.sender?.login !== "string" ||
    typeof event.comment?.user?.login !== "string" ||
    event.sender.login.toLowerCase() !== event.comment.user.login.toLowerCase()
  ) {
    return { kind: "ignored", reason: "unsupported-event" };
  }
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
  const pullRequestNumber = event.issue?.number;
  if (
    typeof pullRequestNumber !== "number" ||
    !Number.isSafeInteger(pullRequestNumber) ||
    pullRequestNumber <= 0
  ) {
    return { kind: "invalid", reason: "Malformed webhook payload" };
  }
  return {
    kind: "accepted",
    event: { ...identity, pullRequestNumber, force: true },
  };
}
