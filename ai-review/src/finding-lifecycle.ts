import {
  JsonClient,
  markdownText,
  type MergedFinding,
} from "../../.github/scripts/ai-review/ai-review.ts";

export const FINDING_MARKER_PREFIX = "ai-review-finding:";

export interface PublishableFinding extends MergedFinding {
  findingId: string;
  hunkIds: string[];
}

export interface FindingPublication {
  findingId: string;
  delivery: "line" | "fallback";
  commentId?: number;
  reconciled: boolean;
  path: string;
  line: number | null;
}

interface ExistingReviewComment {
  id?: unknown;
  body?: unknown;
  in_reply_to_id?: unknown;
  user?: { login?: unknown };
}

interface ReviewCommentResponse {
  id?: unknown;
}

function findingMarker(findingId: string): string {
  return `<!-- ${FINDING_MARKER_PREFIX}${findingId} -->`;
}

export function findingIdFromComment(body: unknown): string | undefined {
  const match = String(body ?? "").match(
    /<!--\s*ai-review-finding:(f_[a-f0-9]{24})\s*-->/i,
  );
  return match?.[1]?.toLowerCase();
}

function renderFindingComment(finding: PublishableFinding): string {
  const status = finding.status === "resolved" ? "RESOLVED" : finding.severity.toUpperCase();
  const lines = [
    findingMarker(finding.findingId),
    `### ${status}: ${markdownText(finding.title, 300)}`,
    "",
    markdownText(finding.evidence),
    "",
    `Suggested fix: ${markdownText(finding.recommendation)}`,
    "",
    `Reported by: ${finding.source_models
      .map((model) => `\`${markdownText(model, 200)}\``)
      .join(", ")} · confidence: ${Math.round(finding.confidence * 100)}%`,
  ];
  if (finding.status === "resolved" && finding.resolution_note) {
    lines.push("", `Resolution: ${markdownText(finding.resolution_note, 500)}`);
  }
  lines.push(
    "",
    `<sub>Finding \`${finding.findingId}\`. Reply or resolve this thread, ` +
      `or use \`/ai-review acknowledge ${finding.findingId} reason\` / ` +
      `\`/ai-review reject ${finding.findingId} reason\`.</sub>`,
  );
  return lines.join("\n");
}

function lineIsAddressable(
  finding: PublishableFinding,
  hunks: Array<{
    hunkId: string;
    file: string;
    newStart: number;
    newLines: number;
  }>,
): boolean {
  if (!finding.line || finding.line < 1) return false;
  const findingHunks = new Set(finding.hunkIds);
  return hunks.some(
    (hunk) =>
      findingHunks.has(hunk.hunkId) &&
      hunk.file === finding.file &&
      hunk.newLines > 0 &&
      finding.line !== null &&
      finding.line >= hunk.newStart &&
      finding.line < hunk.newStart + hunk.newLines,
  );
}

function githubClient(token: string): JsonClient {
  return new JsonClient("https://api.github.com", {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "personal-site-ai-review/1",
    "X-GitHub-Api-Version": "2022-11-28",
  });
}

async function existingFindingComments(options: {
  client: JsonClient;
  repository: string;
  pullRequestNumber: number;
  botLogin: string;
}): Promise<Map<string, number>> {
  const byFinding = new Map<string, number>();
  for (let page = 1; page <= 10; page += 1) {
    const comments = await options.client.request<ExistingReviewComment[]>(
      "GET",
      `/repos/${options.repository}/pulls/${options.pullRequestNumber}/comments`,
      { query: { per_page: 100, page } },
    );
    for (const comment of comments) {
      if (
        comment.user?.login !== options.botLogin ||
        typeof comment.in_reply_to_id === "number"
      ) {
        continue;
      }
      const findingId = findingIdFromComment(comment.body);
      const commentId = Number(comment.id);
      if (findingId && Number.isSafeInteger(commentId) && !byFinding.has(findingId)) {
        byFinding.set(findingId, commentId);
      }
    }
    if (comments.length < 100) break;
  }
  return byFinding;
}

function isUnprocessableReviewComment(error: unknown): boolean {
  return error instanceof Error && /failed \(422\)/.test(error.message);
}

export async function publishFindingComments(options: {
  token: string;
  repository: string;
  pullRequestNumber: number;
  botLogin: string;
  headSha: string;
  findings: PublishableFinding[];
  hunks: Array<{
    hunkId: string;
    file: string;
    newStart: number;
    newLines: number;
  }>;
}): Promise<FindingPublication[]> {
  const client = githubClient(options.token);
  const existing = await existingFindingComments({ ...options, client });
  const publications: FindingPublication[] = [];
  const processed = new Set<string>();

  for (const finding of options.findings) {
    if (processed.has(finding.findingId)) continue;
    processed.add(finding.findingId);
    const existingCommentId = existing.get(finding.findingId);
    if (existingCommentId !== undefined) {
      await client.request(
        "PATCH",
        `/repos/${options.repository}/pulls/comments/${existingCommentId}`,
        { body: { body: renderFindingComment(finding) } },
      );
      publications.push({
        findingId: finding.findingId,
        delivery: "line",
        commentId: existingCommentId,
        reconciled: true,
        path: finding.file,
        line: finding.line,
      });
      continue;
    }

    if (finding.status === "resolved") continue;
    if (!lineIsAddressable(finding, options.hunks)) {
      publications.push({
        findingId: finding.findingId,
        delivery: "fallback",
        reconciled: false,
        path: finding.file,
        line: finding.line,
      });
      continue;
    }

    try {
      const response = await client.request<ReviewCommentResponse>(
        "POST",
        `/repos/${options.repository}/pulls/${options.pullRequestNumber}/comments`,
        {
          body: {
            body: renderFindingComment(finding),
            commit_id: options.headSha,
            path: finding.file,
            line: finding.line,
            side: "RIGHT",
          },
        },
      );
      const commentId = Number(response.id);
      if (!Number.isSafeInteger(commentId)) {
        throw new Error("GitHub returned an invalid review comment ID");
      }
      publications.push({
        findingId: finding.findingId,
        delivery: "line",
        commentId,
        reconciled: false,
        path: finding.file,
        line: finding.line,
      });
    } catch (error) {
      if (!isUnprocessableReviewComment(error)) throw error;
      publications.push({
        findingId: finding.findingId,
        delivery: "fallback",
        reconciled: false,
        path: finding.file,
        line: finding.line,
      });
    }
  }
  return publications;
}

export function renderFallbackFindings(
  findings: PublishableFinding[],
  publications: FindingPublication[],
): string {
  const fallbackIds = new Set(
    publications
      .filter(({ delivery }) => delivery === "fallback")
      .map(({ findingId }) => findingId),
  );
  const fallback = findings.filter(({ findingId }) => fallbackIds.has(findingId));
  if (fallback.length === 0) return "";
  const lines = [
    "## Findings without a diff line",
    "",
    "GitHub could not attach these findings to the current diff. " +
      "Use the commands shown to record an explicit disposition.",
    "",
  ];
  for (const finding of fallback) {
    const location = `${markdownText(finding.file, 500)}${finding.line ? `:${finding.line}` : ""}`;
    lines.push(
      `- **${finding.severity.toUpperCase()}: ` +
        `${markdownText(finding.title, 300)}** (\`${location}\`, ` +
        `\`${finding.findingId}\`) — ${markdownText(finding.evidence, 700)}`,
      `  - \`/ai-review acknowledge ${finding.findingId} <reason>\``,
      `  - \`/ai-review reject ${finding.findingId} <reason>\``,
    );
  }
  return lines.join("\n");
}
