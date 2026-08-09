import {
  TRUSTED_AUTHOR_ASSOCIATIONS,
  type FindingInteractionEvent,
  type ReviewWorkflowParams,
} from "./env";

const encoder = new TextEncoder();
const REVIEW_RELEVANT_PULL_REQUEST_ACTIONS = new Set([
  "opened",
  "synchronize",
  "reopened",
  "ready_for_review",
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
    id?: unknown;
    node_id?: unknown;
    updated_at?: unknown;
    comments?: unknown;
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

export type FindingInteractionParseResult =
  | { kind: "accepted"; event: FindingInteractionEvent }
  | { kind: "ignored"; reason: "unsupported-event" }
  | { kind: "invalid"; reason: "Malformed webhook payload" };

function findingDispositionCommand(body: string):
  | {
      disposition: "acknowledged" | "rejected";
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
  if (action !== "acknowledge" && action !== "reject") return undefined;
  const findingStart = actionEnd + 1;
  const findingEnd = body.indexOf(" ", findingStart);
  if (findingEnd < 0) return undefined;
  const findingId = body.slice(findingStart, findingEnd).toLowerCase();
  if (!/^f_[a-f0-9]{24}$/.test(findingId)) return undefined;
  const reason = body.slice(findingEnd + 1).trim();
  if (!reason) return undefined;
  return {
    disposition: action === "acknowledge" ? "acknowledged" : "rejected",
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
  return (
    actor.toLowerCase() ===
      String(event.pull_request?.user?.login ?? "").toLowerCase() &&
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
): { id: number; reactions?: Record<string, number> } | undefined {
  if (!Array.isArray(thread?.comments)) return undefined;
  const first = thread.comments[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) return undefined;
  const comment = first as { id?: unknown; reactions?: unknown };
  const id = positiveInteger(comment.id);
  return id ? { id, reactions: reactionCounts(comment.reactions) } : undefined;
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
    deliveryId.length === 0
  ) {
    return { kind: "invalid", reason: "Malformed webhook payload" };
  }
  const actor = event.sender?.login;

  if (eventName === "issue_comment" && action === "created") {
    if (typeof event.comment?.body !== "string") {
      return { kind: "ignored", reason: "unsupported-event" };
    }
    const command = findingDispositionCommand(event.comment.body);
    if (!command) return { kind: "ignored", reason: "unsupported-event" };
    const pullRequestNumber = positiveInteger(event.issue?.number);
    if (!pullRequestNumber || event.issue?.pull_request === undefined) {
      return { kind: "invalid", reason: "Malformed webhook payload" };
    }
    if (typeof actor !== "string" || actor.length === 0) {
      return { kind: "invalid", reason: "Malformed webhook payload" };
    }
    if (!actorIsTrusted(event, repository)) {
      return { kind: "ignored", reason: "unsupported-event" };
    }
    return {
      kind: "accepted",
      event: {
        deliveryId,
        eventName,
        action,
        repository,
        pullRequestNumber,
        interactionType: "disposition",
        actor,
        actorAssociation: String(event.comment.author_association ?? ""),
        findingId: command.findingId,
        disposition: command.disposition,
        reason: command.reason,
        commentId: positiveInteger(event.comment.id),
        body: event.comment.body.slice(0, 4_000),
        occurredAt:
          typeof event.comment.created_at === "string"
            ? event.comment.created_at
            : undefined,
      },
    };
  }

  if (
    eventName === "pull_request_review_comment" &&
    new Set(["created", "edited", "deleted"]).has(action)
  ) {
    const pullRequestNumber = positiveInteger(event.pull_request?.number);
    const rootCommentId = positiveInteger(event.comment?.in_reply_to_id);
    const commentId = positiveInteger(event.comment?.id);
    if (!pullRequestNumber || !rootCommentId || !commentId) {
      return { kind: "ignored", reason: "unsupported-event" };
    }
    if (typeof actor !== "string" || actor.length === 0) {
      return { kind: "invalid", reason: "Malformed webhook payload" };
    }
    if (!actorIsTrusted(event, repository)) {
      return { kind: "ignored", reason: "unsupported-event" };
    }
    return {
      kind: "accepted",
      event: {
        deliveryId,
        eventName,
        action,
        repository,
        pullRequestNumber,
        interactionType: "reply",
        actor,
        actorAssociation:
          typeof event.comment?.author_association === "string"
            ? event.comment.author_association
            : undefined,
        rootCommentId,
        commentId,
        body:
          typeof event.comment?.body === "string"
            ? event.comment.body.slice(0, 4_000)
            : undefined,
        reactions: reactionCounts(event.comment?.reactions),
        occurredAt:
          typeof event.comment?.updated_at === "string"
            ? event.comment.updated_at
            : typeof event.comment?.created_at === "string"
              ? event.comment.created_at
              : undefined,
      },
    };
  }

  if (
    eventName === "pull_request_review_thread" &&
    new Set(["resolved", "unresolved"]).has(action)
  ) {
    const pullRequestNumber = positiveInteger(event.pull_request?.number);
    const rootComment = threadRootComment(event.thread);
    if (!pullRequestNumber || !rootComment) {
      return { kind: "invalid", reason: "Malformed webhook payload" };
    }
    if (typeof actor !== "string" || actor.length === 0) {
      return { kind: "invalid", reason: "Malformed webhook payload" };
    }
    if (!actorIsTrusted(event, repository)) {
      return { kind: "ignored", reason: "unsupported-event" };
    }
    const threadId = event.thread?.node_id ?? event.thread?.id;
    return {
      kind: "accepted",
      event: {
        deliveryId,
        eventName,
        action,
        repository,
        pullRequestNumber,
        interactionType: "thread",
        actor,
        rootCommentId: rootComment.id,
        reactions: rootComment.reactions,
        threadId:
          typeof threadId === "string" || typeof threadId === "number"
            ? String(threadId)
            : undefined,
        occurredAt:
          typeof event.thread?.updated_at === "string"
            ? event.thread.updated_at
            : undefined,
      },
    };
  }

  return { kind: "ignored", reason: "unsupported-event" };
}

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
    deliveryId.length === 0
  ) {
    return { kind: "invalid", reason: "Malformed webhook payload" };
  }

  const identity = { deliveryId, eventName, action, repository };
  if (eventName === "pull_request") {
    return parsePullRequestEvent(event, identity);
  }

  if (
    eventName !== "issue_comment" ||
    identity.action !== "created" ||
    event.comment?.body !== "/ai-review" ||
    typeof event.comment.author_association !== "string" ||
    !TRUSTED_AUTHOR_ASSOCIATIONS.has(event.comment.author_association) ||
    typeof event.sender?.login !== "string" ||
    typeof event.comment.user?.login !== "string" ||
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
