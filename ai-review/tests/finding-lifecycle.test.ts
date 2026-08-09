import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findingIdFromComment,
  publishFindingComments,
  renderFallbackFindings,
  type PublishableFinding,
} from "../src/finding-lifecycle";

const finding: PublishableFinding = {
  findingId: `f_${"a".repeat(24)}`,
  hunkIds: [`h_${"b".repeat(24)}`],
  severity: "high",
  file: "app.ts",
  line: 12,
  title: "Unsafe fallback",
  evidence: "The fallback bypasses validation.",
  recommendation: "Validate before returning.",
  confidence: 0.9,
  source_models: ["model/scout"],
  status: "open",
  resolution_note: "",
};

const options = {
  token: "installation-token",
  repository: "owner/repository",
  pullRequestNumber: 42,
  botLogin: "reviewer[bot]",
  headSha: "c".repeat(40),
  findings: [finding],
  hunks: [
    {
      hunkId: finding.hunkIds[0]!,
      file: finding.file,
      newStart: 10,
      newLines: 5,
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("finding lifecycle publication", () => {
  it("extracts stable hidden finding IDs", () => {
    expect(
      findingIdFromComment(`body\n<!-- ai-review-finding:${finding.findingId} -->`),
    ).toBe(finding.findingId);
    expect(findingIdFromComment("ordinary comment")).toBeUndefined();
    expect(findingIdFromComment({ body: finding.findingId })).toBeUndefined();
  });

  it("reconciles an existing bot comment instead of republishing it", async () => {
    const resolvedFinding = {
      ...finding,
      status: "resolved" as const,
      resolution_note: "Fixed by validating the fallback.",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json([
          {
            id: 320,
            in_reply_to_id: 100,
            body: `reply\n<!-- ai-review-finding:${finding.findingId} -->`,
            user: { login: "reviewer[bot]" },
          },
          {
            id: 321,
            body: `old\n<!-- ai-review-finding:${finding.findingId} -->`,
            user: { login: "reviewer[bot]" },
          },
        ]),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      publishFindingComments({ ...options, findings: [resolvedFinding] }),
    ).resolves.toEqual([
      expect.objectContaining({
        findingId: finding.findingId,
        commentId: 321,
        delivery: "line",
        reconciled: true,
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "PATCH" });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/pulls/comments/321");
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain(
      "Fixed by validating the fallback.",
    );
  });

  it("preserves native delivery when a reconciled comment no longer has a line", async () => {
    const movedFinding = { ...finding, line: null };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json([
            {
              id: 321,
              body: `old\n<!-- ai-review-finding:${finding.findingId} -->`,
              user: { login: "reviewer[bot]" },
            },
          ]),
        )
        .mockResolvedValueOnce(new Response(null, { status: 200 })),
    );

    await expect(
      publishFindingComments({ ...options, findings: [movedFinding] }),
    ).resolves.toEqual([
      expect.objectContaining({
        delivery: "line",
        commentId: 321,
        reconciled: true,
        line: null,
      }),
    ]);
  });

  it("publishes an addressable finding as a native review comment", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json({ id: 654 }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const publications = await publishFindingComments(options);

    expect(publications).toEqual([
      expect.objectContaining({
        commentId: 654,
        delivery: "line",
        reconciled: false,
      }),
    ]);
    const request = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(request).toMatchObject({
      commit_id: options.headSha,
      path: "app.ts",
      line: 12,
      side: "RIGHT",
    });
    expect(request.body).toContain(`ai-review-finding:${finding.findingId}`);
  });

  it("fails safely instead of duplicating findings beyond the reconciliation limit", async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      body: "unrelated review comment",
      user: { login: options.botLogin },
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(Response.json(fullPage))),
    );

    await expect(publishFindingComments(options)).rejects.toThrow(
      "1,000-comment safety limit",
    );
  });

  it("falls back to explicit commands for non-line and rejected locations", async () => {
    const nonLine = { ...finding, line: null };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json([])));
    const nonLinePublications = await publishFindingComments({
      ...options,
      findings: [nonLine],
    });
    expect(nonLinePublications).toEqual([
      expect.objectContaining({ delivery: "fallback" }),
    ]);
    expect(nonLinePublications[0]).not.toHaveProperty("commentId");
    expect(renderFallbackFindings([nonLine], nonLinePublications)).toContain(
      `/ai-review reject ${finding.findingId} <reason>`,
    );

    const rejectedFetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(
        new Response('{"message":"line is not part of the diff"}', {
          status: 422,
        }),
      );
    vi.stubGlobal("fetch", rejectedFetch);
    const rejectedPublications = await publishFindingComments(options);
    expect(rejectedPublications).toEqual([
      expect.objectContaining({ delivery: "fallback" }),
    ]);
    expect(renderFallbackFindings([finding], rejectedPublications)).toContain(
      "app.ts:12",
    );
  });

  it("rejects an invalid native review comment identifier", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json([]))
        .mockResolvedValueOnce(Response.json({ id: "not-an-id" }, { status: 201 })),
    );

    await expect(publishFindingComments(options)).rejects.toThrow(
      "GitHub returned an invalid review comment ID",
    );
  });

  it("does not hide unrelated GitHub validation failures as fallbacks", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json([]))
        .mockResolvedValueOnce(
          new Response('{"message":"Validation Failed: commit_id is invalid"}', {
            status: 422,
          }),
        ),
    );

    await expect(publishFindingComments(options)).rejects.toThrow(
      "commit_id is invalid",
    );
  });
});
