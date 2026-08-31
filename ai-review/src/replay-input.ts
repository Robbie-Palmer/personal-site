import type { Env, ReviewWorkflowParams } from "./env";
import type { PreparedReview, ReviewRecordStatus } from "./review-engine";

export const REPLAY_INPUT_SCHEMA_VERSION = 1;
export const REPLAY_MANIFEST_SCHEMA_VERSION = 1;

export function assertReplaySchemaCompatible(value: unknown): asserts value is {
  schemaVersion: typeof REPLAY_INPUT_SCHEMA_VERSION;
  recordType: "ai-review-replay-input";
} {
  const record = value as { schemaVersion?: unknown; recordType?: unknown };
  if (
    record?.schemaVersion !== REPLAY_INPUT_SCHEMA_VERSION ||
    record.recordType !== "ai-review-replay-input"
  ) {
    throw new Error(`Unsupported replay input schema version: ${String(record?.schemaVersion)}`);
  }
}

const SECRET_PATTERNS: Array<[string, RegExp]> = [
  ["private-key", /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g],
  ["authorization", /\b(?:authorization:\s*)?(?:basic|bearer)\s+[^\s"']+/gi],
  ["github-token", /\b(?:gh[opsu]_\w{20,}|github_pat_\w{20,})\b/g],
  ["connection-uri", /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"']+/gi],
];
const ASSIGNMENT_PATTERN = /\b[\w-]+\s*[:=]\s*(?:"[^"\n]*"|'[^'\n]*'|[^\s,;]+)/g;
const SECRET_NAME_PATTERN = /(?:secret|token|password|passwd|api[_-]?key|private[_-]?key)/i;

function redact(value: string, counts: Record<string, number>): string {
  const patternsRedacted = SECRET_PATTERNS.reduce(
    (current, [kind, pattern]) => current.replace(pattern, () => {
      counts[kind] = (counts[kind] ?? 0) + 1;
      return `[REDACTED:${kind}]`;
    }),
    value,
  );
  return patternsRedacted.replace(ASSIGNMENT_PATTERN, (assignment) => {
    const name = assignment.split(/[:=]/, 1)[0]?.trim() ?? "";
    if (name.toLowerCase() !== "database_url" && !SECRET_NAME_PATTERN.test(name)) {
      return assignment;
    }
    counts["assigned-secret"] = (counts["assigned-secret"] ?? 0) + 1;
    return "[REDACTED:assigned-secret]";
  });
}

function redactValue(value: unknown, counts: Record<string, number>): unknown {
  if (typeof value === "string") return redact(value, counts);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, counts));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        redactValue(item, counts),
      ]),
    );
  }
  return value;
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function finite(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function persistReplayInput(options: {
  env: Env;
  params: ReviewWorkflowParams;
  instanceId: string;
  status: ReviewRecordStatus;
  prepared: PreparedReview;
  timestamp: Date;
  prompt: {
    version: string;
    scoutSystem: string;
    scoutSchema: unknown;
    mergerSystem: string;
    mergerSchema: unknown;
  };
  modelSettings: {
    openRouterScouts: string[];
    openCodeScouts: string[];
    merger: string;
    requireZeroDataRetention: boolean;
    scoutMaxTokens: number;
    mergerMaxTokens: number;
    openRouterScoutMaxPrices: unknown;
  };
  policy: unknown;
}): Promise<{ manifestKey: string; snapshotKey: string; snapshotSha256: string }> {
  const { env, params, prepared } = options;
  if (!prepared.baseSha || !prepared.headSha || prepared.fullDiff === undefined) {
    throw new Error("Cannot persist replay input without immutable Git refs and full diff");
  }
  const redactions: Record<string, number> = {};
  const root = ["v2", params.repository, `pr-${params.pullRequestNumber}`, prepared.headSha, options.instanceId, "replay"].join("/");
  const snapshotKey = `${root}/input-v${REPLAY_INPUT_SCHEMA_VERSION}.json`;
  const manifestKey = `${root}/manifest-v${REPLAY_MANIFEST_SCHEMA_VERSION}.json`;
  const productionRecordKey = ["v2", params.repository, `pr-${params.pullRequestNumber}`, prepared.headSha, options.instanceId, `${options.status}.json`].join("/");
  const rawSnapshot = {
    schemaVersion: REPLAY_INPUT_SCHEMA_VERSION,
    recordType: "ai-review-replay-input",
    repository: params.repository,
    pullRequestNumber: params.pullRequestNumber,
    productionRunId: options.instanceId,
    git: { baseSha: prepared.baseSha, headSha: prepared.headSha },
    input: {
      fullDiff: prepared.fullDiff,
      reviewedDiff: prepared.diff ?? "",
      boundedFileContext: prepared.context ?? "",
      repositoryGuidelines: prepared.guidelines ?? "",
      reviewThreads: prepared.threads ?? "",
      priorOpenFindings: prepared.priorOpenFindings ?? [],
      affectedOpenFindings: prepared.replayFindings ?? [],
    },
    decision: {
      changeProfile: prepared.changeProfile,
      coverage: prepared.coverage,
      paths: prepared.paths,
      omittedPaths: prepared.omitted,
    },
    prompt: options.prompt,
    policy: options.policy,
    modelRequest: options.modelSettings,
    budget: {
      maxRunsPerPullRequest: finite(env.AI_REVIEW_MAX_RUNS_PER_PR, 20),
      maxCostUsdPerPullRequest: finite(env.AI_REVIEW_MAX_PR_COST_USD, 5),
    },
    provenance: {
      diffFingerprint: prepared.diffFingerprint,
      configFingerprint: prepared.configFingerprint,
      trigger: { deliveryId: params.deliveryId, eventName: params.eventName, action: params.action, force: params.force },
      capturedAt: options.timestamp.toISOString(),
    },
  };
  const snapshot = redactValue(rawSnapshot, redactions) as typeof rawSnapshot;
  Object.assign(snapshot.provenance, {
    redactions,
    liveCredentialsIncluded: false,
  });
  const snapshotJson = stableJson(snapshot);
  const snapshotSha256 = await sha256(snapshotJson);
  const retentionDays = finite(env.AI_REVIEW_DATA_RETENTION_DAYS, 365);
  const expiresAt = new Date(options.timestamp.getTime() + retentionDays * 86_400_000).toISOString();
  const manifest = {
    schemaVersion: REPLAY_MANIFEST_SCHEMA_VERSION,
    recordType: "ai-review-replay-manifest",
    productionRunId: options.instanceId,
    productionRecordKey,
    snapshot: { key: snapshotKey, sha256: snapshotSha256, schemaVersion: REPLAY_INPUT_SCHEMA_VERSION },
    findingOutcomesPrefix: ["v2", params.repository, `pr-${params.pullRequestNumber}`, "findings"].join("/"),
    retention: { days: retentionDays, expiresAt },
  };
  await env.REVIEW_DATA.put(snapshotKey, snapshotJson, {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { sha256: snapshotSha256, schemaVersion: String(REPLAY_INPUT_SCHEMA_VERSION) },
  });
  await env.REVIEW_DATA.put(manifestKey, stableJson(manifest), {
    httpMetadata: { contentType: "application/json" },
  });
  return { manifestKey, snapshotKey, snapshotSha256 };
}
