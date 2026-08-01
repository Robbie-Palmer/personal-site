import { describe, expect, it, vi } from "vitest";

// Route enumeration only reads `app.routes`; handlers never execute here. The
// postgres stub keeps importing the app free of any driver import-time work,
// mirroring the pattern the behavioural suites use.
vi.mock("postgres", () => ({ default: () => ({}) }));

import { app } from "../src/index";

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

// Segments that are legitimate non-CRUD state transitions, not resources.
const ACTION_ALLOWLIST = new Set([
  "accept",
  "decline",
  "leave",
  "read-all",
  "clear-all",
]);

// A segment is "verb-shaped" when its leading hyphen-token is one of these.
// Named read views (discover, cooks) are intentionally absent.
const VERB_PREFIXES = new Set([
  "import",
  "restore",
  "recommend",
  "generate",
  "validate",
  "sync",
  "create",
  "update",
  "delete",
  "fetch",
  "send",
]);

// Convention violations that exist today, tracked as debt to burn down under
// recipe-site ADR 065. Remove an entry when its route is fixed — the "no stale
// baseline" test fails if you forget, so the list can only shrink.
const KNOWN_VERB_PATH_VIOLATIONS = new Set([
  "POST /recipes/import-url",
  "POST /recipes/import-file",
  "PUT /pantry/restore",
]);

type Route = { method: string; path: string };

function httpRoutes(): Route[] {
  const seen = new Set<string>();
  const routes: Route[] = [];
  for (const { method, path } of app.routes as Route[]) {
    // Skip middleware, which Hono records with the ALL method.
    if (!HTTP_METHODS.has(method)) continue;
    const key = `${method} ${path}`;
    if (seen.has(key)) continue; // collapse per-handler duplicate entries
    seen.add(key);
    routes.push({ method, path });
  }
  return routes;
}

function staticSegments(path: string): string[] {
  // Exclude dynamic segments: Hono params (:id) and wildcards (*), e.g. the
  // better-auth sub-app mounted at /api/auth/*.
  return path
    .split("/")
    .filter((s) => s.length > 0 && !s.startsWith(":") && s !== "*");
}

function hasVerbSegment(path: string): boolean {
  return staticSegments(path).some(
    (segment) =>
      !ACTION_ALLOWLIST.has(segment) &&
      VERB_PREFIXES.has(segment.split("-")[0] ?? ""),
  );
}

describe("recipe-api route conventions", () => {
  const routes = httpRoutes();

  it("registers only standard HTTP methods", () => {
    const offenders = (app.routes as Route[])
      .map((r) => r.method)
      .filter((method) => method !== "ALL" && !HTTP_METHODS.has(method));
    expect(offenders, JSON.stringify(offenders)).toEqual([]);
  });

  it("uses kebab-case static path segments", () => {
    const offenders = routes.filter(({ path }) =>
      staticSegments(path).some((s) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)),
    );
    expect(offenders, JSON.stringify(offenders)).toEqual([]);
  });

  it("has no trailing slashes", () => {
    const offenders = routes.filter(
      ({ path }) => path !== "/" && path.endsWith("/"),
    );
    expect(offenders, JSON.stringify(offenders)).toEqual([]);
  });

  it("keeps verbs out of paths (allowlisted actions and baseline aside)", () => {
    const offenders = routes.filter(
      ({ method, path }) =>
        !KNOWN_VERB_PATH_VIOLATIONS.has(`${method} ${path}`) &&
        hasVerbSegment(path),
    );
    expect(
      offenders,
      `verb-shaped path segments: ${JSON.stringify(offenders)}`,
    ).toEqual([]);
  });

  it("keeps the ADR 065 violation baseline free of stale entries", () => {
    // The baseline is shrink-only: every entry must name a route that still
    // exists AND still violates the verb rule. A route that was renamed,
    // removed, or made compliant (verb dropped, or its segment allowlisted)
    // no longer qualifies, so its baseline entry is stale and must be deleted.
    const liveViolations = new Set(
      routes
        .filter(({ path }) => hasVerbSegment(path))
        .map(({ method, path }) => `${method} ${path}`),
    );
    const stale = [...KNOWN_VERB_PATH_VIOLATIONS].filter(
      (v) => !liveViolations.has(v),
    );
    expect(
      stale,
      `baseline entries that no longer violate — delete them: ${JSON.stringify(stale)}`,
    ).toEqual([]);
  });
});
