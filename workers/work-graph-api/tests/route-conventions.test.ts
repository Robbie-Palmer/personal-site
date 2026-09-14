import { describe, expect, it } from "vitest";
import {
  createWorkGraphApp,
  type WorkGraphApiRepository,
} from "../src/index";

const unavailable = async (): Promise<never> => {
  throw new Error("Repository operations are unavailable in route tests.");
};
const app = createWorkGraphApp({
  listWorkItems: unavailable,
  getWorkItem: unavailable,
  createWorkItem: unavailable,
  addDependency: unavailable,
  removeDependency: unavailable,
  claimWorkItem: unavailable,
  renewLease: unavailable,
  terminateClaimedWorkItem: unavailable,
} satisfies WorkGraphApiRepository);
const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

type Route = { method: string; path: string };

const httpRoutes = (): Route[] => {
  const routes = new Map<string, Route>();
  for (const route of app.routes as Route[]) {
    if (!HTTP_METHODS.has(route.method)) continue;
    routes.set(`${route.method} ${route.path}`, route);
  }
  return [...routes.values()];
};

describe("Given the Work Graph route registry", () => {
  it("documents every runtime route in generated OpenAPI", () => {
    const document = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "route parity", version: "test" },
    });
    const documented = Object.entries(document.paths ?? {}).flatMap(
      ([path, pathItem]) =>
        Object.keys(pathItem ?? {})
          .filter((method) => HTTP_METHODS.has(method.toUpperCase()))
          .map((method) => `${method.toUpperCase()} ${path}`),
    );
    const runtime = httpRoutes().map(
      ({ method, path }) =>
        `${method} ${path.replace(/:([A-Za-z0-9_]+)/g, "{$1}")}`,
    );

    expect(documented.sort()).toEqual(runtime.sort());
  });

  it("uses noun-based kebab-case paths without trailing slashes", () => {
    const offenders = httpRoutes().filter(({ path }) => {
      if (path.endsWith("/")) return true;
      return path
        .split("/")
        .filter((segment) => segment && !segment.startsWith(":"))
        .some((segment) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(segment));
    });

    expect(offenders).toEqual([]);
    expect(
      httpRoutes()
        .map(({ method, path }) => `${method} ${path}`)
        .sort(),
    ).toEqual(
      [
        "DELETE /api/dependencies",
        "GET /api/work-items",
        "GET /api/work-items/:workItemId",
        "POST /api/dependencies",
        "POST /api/leases",
        "POST /api/leases/:leaseId/renewals",
        "POST /api/work-items",
        "POST /api/work-items/:workItemId/cancellations",
        "POST /api/work-items/:workItemId/releases",
      ].sort(),
    );
  });
});
