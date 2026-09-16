import { describe, expect, it, vi } from "vitest";
import type { Fetch } from "../src/client.js";
import { EXIT_CODES } from "../src/errors.js";
import { runCli } from "../src/main.js";

interface CapturedRequest {
  body: unknown;
  headers: Headers;
  method: string;
  url: URL;
}

const API_URL = "https://work.example.test/root";
const UUID = "00000000-0000-4000-8000-000000000001";
const MERGE_EVIDENCE = "https://github.com/example/work-graph/pull/1";
const DEPLOYMENT_EVIDENCE = "https://work-graph.example.test/health";

const response = (body: unknown = { ok: true }, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const harness = (
  responseFactory: (request: CapturedRequest) => Response = () => response(),
  environment: NodeJS.ProcessEnv = { WORK_GRAPH_API_URL: API_URL },
  makeUuid: () => string = () => UUID,
) => {
  const requests: CapturedRequest[] = [];
  const stdout: string[] = [];
  const stderr: string[] = [];
  const fetch: Fetch = vi.fn(async (input, init) => {
    const request =
      input instanceof Request ? input : new Request(input, init);
    const text =
      request.method === "GET" || request.method === "HEAD"
        ? ""
        : await request.clone().text();
    const captured = {
      body: text === "" ? undefined : JSON.parse(text),
      headers: request.headers,
      method: request.method,
      url: new URL(request.url),
    };
    requests.push(captured);
    return responseFactory(captured);
  });
  const run = (args: string[]) =>
    runCli(args, {
      environment,
      fetch,
      makeUuid,
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    });
  return { fetch, requests, run, stderr, stdout };
};

describe("Given agent-facing Work Graph commands", () => {
  it("manages knowledge-scope mirrors and relationships", async () => {
    const list = harness();
    const show = harness();
    const put = harness();
    const links = harness();
    const link = harness();
    const unlink = harness();

    await list.run([
      "scope",
      "list",
      "--kind",
      "project",
      "--limit",
      "10",
      "--cursor",
      "first",
    ]);
    await show.run(["scope", "show", "work/a b"]);
    await put.run([
      "scope",
      "put",
      "work-graph",
      "--kind",
      "project",
      "--title",
      "Work Graph",
      "--canonical-url",
      "https://example.test/projects/work-graph",
      "--markdown-url",
      "https://example.test/projects/work-graph.md",
      "--source-revision",
      "abc123",
      "--rank",
      "2",
      "--priority-weight",
      "10",
      "--idempotency-key",
      UUID,
    ]);
    await links.run([
      "scope",
      "links",
      "--limit",
      "10",
      "--cursor",
      '["initiative","work-graph"]',
    ]);
    await link.run([
      "scope",
      "link",
      "initiative",
      "work-graph",
      "--idempotency-key",
      UUID,
    ]);
    await unlink.run([
      "scope",
      "unlink",
      "initiative",
      "work-graph",
      "--idempotency-key",
      UUID,
    ]);

    expect(list.requests[0]?.url.href).toBe(
      "https://work.example.test/root/api/knowledge-scopes?kind=project&limit=10&cursor=first",
    );
    expect(show.requests[0]?.url.pathname).toBe(
      "/root/api/knowledge-scopes/work%2Fa%20b",
    );
    expect(put.requests[0]).toMatchObject({
      method: "PUT",
      body: {
        kind: "project",
        title: "Work Graph",
        canonicalUrl: "https://example.test/projects/work-graph",
        markdownUrl: "https://example.test/projects/work-graph.md",
        sourceRevision: "abc123",
        rank: 2,
        priorityWeight: 10,
      },
    });
    expect(put.requests[0]?.headers.get("Idempotency-Key")).toBe(UUID);
    expect(links.requests[0]?.url.href).toBe(
      "https://work.example.test/root/api/knowledge-scope-relationships?limit=10&cursor=%5B%22initiative%22%2C%22work-graph%22%5D",
    );
    expect(link.requests[0]).toMatchObject({
      method: "POST",
      body: {
        parentKnowledgeScopeId: "initiative",
        childKnowledgeScopeId: "work-graph",
      },
    });
    expect(unlink.requests[0]).toMatchObject({
      method: "DELETE",
      body: {
        parentKnowledgeScopeId: "initiative",
        childKnowledgeScopeId: "work-graph",
      },
    });
  });

  it("creates a work item and forwards its idempotency key", async () => {
    const test = harness();
    expect(
      await test.run([
        "create",
        "cli-8",
        "--title",
        "Build the CLI",
        "--parent-id",
        "mvp",
        "--idempotency-key",
        UUID,
      ]),
    ).toBe(EXIT_CODES.success);
    expect(test.requests[0]).toMatchObject({
      body: { id: "cli-8", title: "Build the CLI", parentId: "mvp" },
      method: "POST",
    });
    expect(test.requests[0]?.url.href).toBe(
      "https://work.example.test/root/api/work-items",
    );
    expect(test.requests[0]?.headers.get("Idempotency-Key")).toBe(UUID);
    expect(test.stdout).toEqual(['{"ok":true}\n']);
    expect(test.stderr).toEqual([]);
  });

  it("lists the ready queue by default and supports an unfiltered page", async () => {
    const ready = harness();
    const all = harness();
    await ready.run(["queue", "--limit", "7", "--cursor", "item-1"]);
    await all.run(["queue", "--all"]);
    expect(ready.requests[0]?.url.href).toBe(
      "https://work.example.test/root/api/work-items?stage=ready&limit=7&cursor=item-1",
    );
    expect(all.requests[0]?.url.href).toBe(
      "https://work.example.test/root/api/work-items",
    );
  });

  it("claims the next item or a specified item", async () => {
    const next = harness();
    const specified = harness();
    await next.run(["claim", "--worker-id", "agent-a"]);
    await specified.run([
      "claim",
      "work/a b",
      "--worker-id",
      "agent-a",
      "--lease-duration-seconds",
      "120",
    ]);
    expect(next.requests[0]?.body).toEqual({
      workerId: "agent-a",
      leaseDurationSeconds: 900,
    });
    expect(specified.requests[0]?.body).toEqual({
      workerId: "agent-a",
      leaseDurationSeconds: 120,
      workItemId: "work/a b",
    });
  });

  it("shows a work item with an encoded path identifier", async () => {
    const test = harness();
    await test.run(["show", "work/a b"]);
    expect(test.requests[0]?.url.pathname).toBe("/root/api/work-items/work%2Fa%20b");
    expect(test.requests[0]?.method).toBe("GET");
  });

  it("records a fenced note with a generated ID", async () => {
    const test = harness();
    await test.run([
      "note",
      "item-1",
      "--lease-id",
      UUID,
      "--epoch",
      "2",
      "--content",
      "Tests pass",
    ]);
    expect(test.requests[0]).toMatchObject({
      body: {
        id: UUID,
        leaseId: UUID,
        epoch: 2,
        content: "Tests pass",
      },
      method: "POST",
    });
    expect(test.requests[0]?.url.pathname).toBe(
      "/root/api/work-items/item-1/notes",
    );
  });

  it("renews a fenced lease", async () => {
    const test = harness();
    await test.run(["renew", UUID, "--epoch", "4"]);
    expect(test.requests[0]).toMatchObject({
      body: { epoch: 4, leaseDurationSeconds: 900 },
      method: "POST",
    });
    expect(test.requests[0]?.url.pathname).toBe(
      `/root/api/leases/${UUID}/renewals`,
    );
  });

  it("decomposes work and can claim one child in the same request", async () => {
    const test = harness();
    const children = [{ id: "child-1", title: "First", rank: 1 }];
    const dependencies = [
      { dependentWorkItemId: "child-1", blockerWorkItemId: "blocker-1" },
    ];
    await test.run([
      "decompose",
      "parent-1",
      "--lease-id",
      UUID,
      "--epoch",
      "3",
      "--children-json",
      JSON.stringify(children),
      "--dependencies-json",
      JSON.stringify(dependencies),
      "--claim-work-item-id",
      "child-1",
      "--claim-lease-duration-seconds",
      "300",
    ]);
    expect(test.requests[0]?.body).toEqual({
      leaseId: UUID,
      epoch: 3,
      children,
      dependencies,
      claim: {
        workItemId: "child-1",
        leaseId: UUID,
        leaseDurationSeconds: 300,
      },
    });
    expect(test.requests[0]?.url.pathname).toBe(
      "/root/api/work-items/parent-1/decompositions",
    );
  });

  it("lists, creates, and resolves attention requests", async () => {
    const list = harness();
    const request = harness();
    const resolve = harness();
    await list.run([
      "attention",
      "list",
      "--state",
      "resolved",
      "--blocking",
      "false",
    ]);
    await request.run([
      "attention",
      "request",
      "item-1",
      "--lease-id",
      UUID,
      "--epoch",
      "5",
      "--kind",
      "decision",
      "--question",
      "Which host?",
      "--non-blocking",
    ]);
    await resolve.run([
      "attention",
      "resolve",
      UUID,
      "--resolution",
      "Use the Worker",
    ]);
    expect(list.requests[0]?.url.search).toBe(
      "?state=resolved&blocking=false",
    );
    expect(request.requests[0]?.body).toEqual({
      id: UUID,
      workItemId: "item-1",
      leaseId: UUID,
      epoch: 5,
      kind: "decision",
      question: "Which host?",
      blocking: false,
    });
    expect(resolve.requests[0]?.body).toEqual({
      id: UUID,
      resolution: "Use the Worker",
    });
    expect(resolve.requests[0]?.url.pathname).toBe(
      `/root/api/attention-requests/${UUID}/resolutions`,
    );
  });

  it("keeps generated mutation IDs stable across idempotent retries", async () => {
    const makeUuid = vi.fn(() => "00000000-0000-4000-8000-000000000002");
    const test = harness(undefined, { WORK_GRAPH_API_URL: API_URL }, makeUuid);
    const retryBodies = async (
      args: string[],
    ): Promise<[Record<string, unknown>, Record<string, unknown>]> => {
      const offset = test.requests.length;
      await test.run(args);
      await test.run(args);
      return [
        test.requests[offset]?.body as Record<string, unknown>,
        test.requests[offset + 1]?.body as Record<string, unknown>,
      ];
    };

    const [firstNote, retriedNote] = await retryBodies([
      "note",
      "item-1",
      "--lease-id",
      UUID,
      "--epoch",
      "1",
      "--content",
      "Stable retry",
      "--idempotency-key",
      UUID,
    ]);
    const [firstRequest, retriedRequest] = await retryBodies([
      "attention",
      "request",
      "item-1",
      "--lease-id",
      UUID,
      "--epoch",
      "1",
      "--kind",
      "decision",
      "--question",
      "Which host?",
      "--idempotency-key",
      UUID,
    ]);
    const [firstResolution, retriedResolution] = await retryBodies([
      "attention",
      "resolve",
      UUID,
      "--resolution",
      "Use the Worker",
      "--idempotency-key",
      UUID,
    ]);
    const [firstDecomposition, retriedDecomposition] = await retryBodies([
      "decompose",
      "parent-1",
      "--lease-id",
      UUID,
      "--epoch",
      "1",
      "--children-json",
      '[{"id":"child-1","title":"First","rank":1}]',
      "--claim-work-item-id",
      "child-1",
      "--idempotency-key",
      UUID,
    ]);

    expect(retriedNote.id).toBe(firstNote.id);
    expect(retriedRequest.id).toBe(firstRequest.id);
    expect(retriedResolution.id).toBe(firstResolution.id);
    expect(
      (retriedDecomposition.claim as Record<string, unknown>).leaseId,
    ).toBe((firstDecomposition.claim as Record<string, unknown>).leaseId);
    expect(firstNote.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(makeUuid).not.toHaveBeenCalled();
  });

  it("completes merged and deployed claimed work", async () => {
    const test = harness();
    await test.run([
      "release",
      "item-1",
      "--lease-id",
      UUID,
      "--epoch",
      "6",
      "--merge-evidence",
      MERGE_EVIDENCE,
      "--deployment-evidence",
      DEPLOYMENT_EVIDENCE,
    ]);
    expect(test.requests[0]).toMatchObject({
      body: {
        leaseId: UUID,
        epoch: 6,
        mergeEvidence: MERGE_EVIDENCE,
        deploymentEvidence: DEPLOYMENT_EVIDENCE,
      },
      method: "POST",
    });
    expect(test.requests[0]?.url.pathname).toBe(
      "/root/api/work-items/item-1/releases",
    );
  });

  it("refuses to release work without merge and deployment evidence", async () => {
    const test = harness();
    expect(
      await test.run([
        "release",
        "item-1",
        "--lease-id",
        UUID,
        "--epoch",
        "6",
      ]),
    ).toBe(EXIT_CODES.usage);
    expect(test.requests).toEqual([]);
  });

  it("refuses whitespace-only release evidence before making a request", async () => {
    const test = harness();
    expect(
      await test.run([
        "release",
        "item-1",
        "--lease-id",
        UUID,
        "--epoch",
        "6",
        "--merge-evidence",
        " ",
        "--deployment-evidence",
        DEPLOYMENT_EVIDENCE,
      ]),
    ).toBe(EXIT_CODES.usage);
    expect(test.requests).toEqual([]);
  });

  it("cancels claimed work", async () => {
    const test = harness();
    await test.run([
      "cancel",
      "item-1",
      "--lease-id",
      UUID,
      "--epoch",
      "6",
    ]);
    expect(test.requests[0]).toMatchObject({
      body: { leaseId: UUID, epoch: 6 },
      method: "POST",
    });
    expect(test.requests[0]?.url.pathname).toBe(
      "/root/api/work-items/item-1/cancellations",
    );
  });
});

describe("Given Cloudflare Access service-token credentials", () => {
  it("sends both headers only to an explicitly trusted API origin", async () => {
    const test = harness(undefined, {
      WORK_GRAPH_API_URL: API_URL,
      WORK_GRAPH_CF_ACCESS_ALLOWED_ORIGINS: "https://work.example.test",
      CF_ACCESS_CLIENT_ID: "client-id.secret",
      CF_ACCESS_CLIENT_SECRET: "client-secret",
    });
    expect(await test.run(["show", "item-1"])).toBe(EXIT_CODES.success);
    expect(test.requests[0]?.headers.get("CF-Access-Client-Id")).toBe(
      "client-id.secret",
    );
    expect(test.requests[0]?.headers.get("CF-Access-Client-Secret")).toBe(
      "client-secret",
    );
  });

  it("refuses an untrusted API origin before making a request or printing secrets", async () => {
    const test = harness(undefined, {
      WORK_GRAPH_API_URL: "https://attacker.example.test",
      WORK_GRAPH_CF_ACCESS_ALLOWED_ORIGINS: "https://work.example.test",
      CF_ACCESS_CLIENT_ID: "sensitive-client-id",
      CF_ACCESS_CLIENT_SECRET: "sensitive-client-secret",
    });
    expect(await test.run(["show", "item-1"])).toBe(EXIT_CODES.usage);
    expect(test.fetch).not.toHaveBeenCalled();
    expect(test.stderr.join("")).toContain("UNTRUSTED_ACCESS_ORIGIN");
    expect(test.stderr.join("")).not.toContain("sensitive-client");
  });

  it("does not follow redirects carrying custom Access headers", async () => {
    const test = harness(
      () =>
        new Response(null, {
          status: 302,
          headers: { Location: "https://attacker.example.test/collect" },
        }),
      {
        WORK_GRAPH_API_URL: API_URL,
        WORK_GRAPH_CF_ACCESS_ALLOWED_ORIGINS: "https://work.example.test",
        CF_ACCESS_CLIENT_ID: "client-id.secret",
        CF_ACCESS_CLIENT_SECRET: "client-secret",
      },
    );
    expect(await test.run(["show", "item-1"])).toBe(EXIT_CODES.transport);
    expect(test.fetch).toHaveBeenCalledTimes(1);
    const request = vi.mocked(test.fetch).mock.calls[0]?.[0];
    expect(request).toBeInstanceOf(Request);
    expect((request as Request).redirect).toBe("manual");
    expect(JSON.parse(test.stderr[0] ?? "null")).toEqual({
      error: {
        code: "REDIRECT_REFUSED",
        message:
          "The Work Graph API returned a redirect. Refusing to forward Access credentials.",
        status: 302,
      },
    });
  });

  it("accepts an API URL and trusted origin as global options", async () => {
    const test = harness(undefined, {
      CF_ACCESS_CLIENT_ID: "client-id.secret",
      CF_ACCESS_CLIENT_SECRET: "client-secret",
    });
    expect(
      await test.run([
        "--api-url",
        API_URL,
        "--cf-access-allowed-origin",
        "https://work.example.test",
        "show",
        "item-1",
      ]),
    ).toBe(EXIT_CODES.success);
    expect(test.requests[0]?.url.origin).toBe("https://work.example.test");
    expect(test.requests[0]?.headers.get("CF-Access-Client-Secret")).toBe(
      "client-secret",
    );
  });
});

describe("Given CLI and HTTP failures", () => {
  it.each([
    [400, EXIT_CODES.validation],
    [401, EXIT_CODES.authentication],
    [403, EXIT_CODES.authentication],
    [404, EXIT_CODES.notFound],
    [409, EXIT_CODES.conflict],
    [422, EXIT_CODES.validation],
    [500, EXIT_CODES.server],
    [418, EXIT_CODES.transport],
  ])("maps HTTP %i to exit code %i and preserves API error JSON", async (status, exitCode) => {
    const test = harness(() =>
      response(
        {
          error: {
            code: "API_PROBLEM",
            message: "Request failed",
            details: [{ path: ["body"], message: "Bad value" }],
          },
        },
        status,
      ),
    );
    expect(await test.run(["show", "item-1"])).toBe(exitCode);
    expect(JSON.parse(test.stderr[0] ?? "null")).toEqual({
      error: {
        code: "API_PROBLEM",
        message: "Request failed",
        status,
        details: [{ path: ["body"], message: "Bad value" }],
      },
    });
    expect(test.stdout).toEqual([]);
  });

  it("returns structured usage errors without making an HTTP request", async () => {
    const test = harness();
    expect(await test.run(["renew", UUID, "--epoch", "zero"])).toBe(
      EXIT_CODES.usage,
    );
    expect(test.fetch).not.toHaveBeenCalled();
    expect(JSON.parse(test.stderr[0] ?? "null")).toEqual({
      error: {
        code: "CLI_USAGE",
        message: "✖ Invalid input: expected number, received string → at epoch",
      },
    });
  });

  it("enforces generated OpenAPI constraints before making a request", async () => {
    const test = harness();
    expect(
      await test.run(["create", "item-1", "--title", "x".repeat(10_001)]),
    ).toBe(EXIT_CODES.usage);
    expect(test.fetch).not.toHaveBeenCalled();
    expect(test.stderr.join("")).toContain("title");
    expect(test.stderr.join("")).toContain("10000");
  });

  it.each(["ftp://example.test/projects/work-graph", "https://"])(
    "rejects a scope URL outside the generated HTTP contract: %s",
    async (canonicalUrl) => {
      const test = harness();
      expect(
        await test.run([
          "scope",
          "put",
          "work-graph",
          "--kind",
          "project",
          "--title",
          "Work Graph",
          "--canonical-url",
          canonicalUrl,
          "--markdown-url",
          "https://example.test/projects/work-graph.md",
        ]),
      ).toBe(EXIT_CODES.usage);
      expect(test.fetch).not.toHaveBeenCalled();
      expect(test.stderr.join("")).toContain("canonicalUrl");
    },
  );

  it("accepts complete command input as JSON for agents", async () => {
    const test = harness();
    expect(
      await test.run([
        "create",
        "--json",
        JSON.stringify({ id: "item-1", title: "From JSON" }),
      ]),
    ).toBe(EXIT_CODES.success);
    expect(test.requests[0]?.body).toEqual({
      id: "item-1",
      title: "From JSON",
    });
  });

  it("reports non-JSON and network failures as transport errors", async () => {
    const invalid = harness(() => new Response("Access login", { status: 200 }));
    const offline = harness();
    vi.mocked(offline.fetch).mockRejectedValueOnce(new Error("offline"));
    expect(await invalid.run(["show", "item-1"])).toBe(EXIT_CODES.transport);
    expect(await offline.run(["show", "item-1"])).toBe(EXIT_CODES.transport);
    expect(invalid.stderr.join("")).toContain("INVALID_API_RESPONSE");
    expect(offline.stderr.join("")).toContain("TRANSPORT_ERROR");
  });

  it("maps a non-JSON Cloudflare rejection to the authentication exit code", async () => {
    const test = harness(() => new Response("Access denied", { status: 403 }));
    expect(await test.run(["show", "item-1"])).toBe(
      EXIT_CODES.authentication,
    );
    expect(JSON.parse(test.stderr[0] ?? "null")).toEqual({
      error: {
        code: "HTTP_403",
        message: "The Work Graph API returned HTTP 403.",
        status: 403,
      },
    });
  });

  it("shows help without requiring API configuration", async () => {
    const test = harness(undefined, {});
    expect(await test.run(["--help"])).toBe(EXIT_CODES.success);
    expect(test.stdout.join("")).toContain("Usage: work-graph");
    expect(test.stdout.join("")).toContain("create");
    expect(test.stdout.join("")).toContain("Create a work item");
    expect(test.fetch).not.toHaveBeenCalled();
  });

  it("derives command help from Zod field descriptions", async () => {
    const test = harness(undefined, {});
    expect(await test.run(["create", "--help"])).toBe(EXIT_CODES.success);
    expect(test.stdout.join("")).toContain("Create a work item");
    expect(test.stdout.join("")).toContain("Work-item ID");
    expect(test.stdout.join("")).toContain("--title <string>");
    expect(test.stdout.join("")).toContain("Work-item title");
    expect(test.fetch).not.toHaveBeenCalled();
  });

  it("describes release as completion after merge and deployment", async () => {
    const test = harness(undefined, {});
    expect(await test.run(["release", "--help"])).toBe(EXIT_CODES.success);
    const help = test.stdout.join("");
    expect(help).toContain(
      "Complete claimed work after it is merged and deployed",
    );
    expect(help).toContain("--merge-evidence <string>");
    expect(help).toContain("--deployment-evidence <string>");
    expect(help).not.toContain("back to the queue");
    expect(test.fetch).not.toHaveBeenCalled();
  });
});
