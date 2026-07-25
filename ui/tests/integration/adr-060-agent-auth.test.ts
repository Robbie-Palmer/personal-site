import { beforeAll, describe, expect, it } from "vitest";
import { summarizeMarkdown } from "@/lib/domain/adr/adrQueries";
import { type ADR, parseADRRef } from "@/lib/domain/adr/adr";
import {
  type DomainRepository,
  getADRSlugsForProject,
  getProjectForADR,
  getTechnologiesForADR,
  loadDomainRepository,
} from "@/lib/repository";

/**
 * Content test for ADR 060: "Agent Auth for Delegated Recipe Access"
 * (ui/content/projects/recipe-site/adrs/060-agent-auth.mdx).
 *
 * loadDomainRepository() parses the real content directory, validates every
 * ADR against the Zod schema, and builds the relation graph. These tests
 * confirm that the newly added ADR file is well-formed, is wired into the
 * project/technology graph correctly, and that the internal links it makes
 * to other ADRs resolve to real content.
 */
describe("ADR 060: Agent Auth for Delegated Recipe Access", () => {
  const adrRef = "recipe-site:060-agent-auth";
  let repo: DomainRepository;
  let adr: ADR;

  beforeAll(() => {
    repo = loadDomainRepository();
    const loadedADR = repo.adrs.get(adrRef);
    if (!loadedADR) {
      throw new Error(`Expected ADR '${adrRef}' to be loaded`);
    }
    adr = loadedADR;
  });

  it("loads successfully with no referential integrity errors", () => {
    expect(repo.referentialIntegrityErrors).toEqual([]);
    expect(repo.adrs.has(adrRef)).toBe(true);
  });

  it("has the expected frontmatter values", () => {
    expect(adr.slug).toBe("060-agent-auth");
    expect(adr.projectSlug).toBe("recipe-site");
    expect(adr.title).toBe("ADR 060: Agent Auth for Delegated Recipe Access");
    expect(adr.date).toBe("2026-07-25");
    expect(adr.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(adr.status).toBe("Proposed");
    expect(adr.inheritsFrom).toBeUndefined();
    expect(adr.supersedes).toBeUndefined();
  });

  it("computes a non-empty reading time", () => {
    expect(adr.readingTime).toBeTruthy();
    expect(typeof adr.readingTime).toBe("string");
  });

  it("is associated with the recipe-site project in the graph", () => {
    const owningProject = getProjectForADR(repo.graph, adrRef);
    expect(owningProject).toBe("recipe-site");

    const projectADRSlugs = getADRSlugsForProject(repo.graph, "recipe-site");
    expect(projectADRSlugs).toContain(adrRef);
  });

  it("declares Better Auth as its only technology", () => {
    const techSlugs = getTechnologiesForADR(repo.graph, adrRef);
    expect(Array.from(techSlugs)).toEqual(["better-auth"]);

    const technology = repo.technologies.get("better-auth");
    expect(technology).toBeDefined();
    expect(technology?.name).toBe("Better Auth");
  });

  it("contains the expected top-level sections", () => {
    const expectedHeadings = [
      "# Summary",
      "# Context",
      "# Decision",
      "## Initial Capability Surface",
      "## Reversible Writes",
      "## Enforcement and Operations",
      "# Standards Landscape: Complementary Layers",
      "# Rollout",
      "# Consequences",
      "## Positive",
      "## Negative",
      "# When To Revisit",
    ];

    for (const heading of expectedHeadings) {
      expect(
        adr.content.includes(heading),
        `Expected content to contain heading "${heading}"`,
      ).toBe(true);
    }
  });

  it("embeds a Mermaid sequence diagram illustrating the delegated auth flow", () => {
    expect(adr.content).toContain("<Mermaid");
    expect(adr.content).toContain("sequenceDiagram");
    expect(adr.content).toContain("participant A as Agent + keypair");
    expect(adr.content).toContain(
      "participant Auth as Better Auth Agent Auth",
    );
  });

  it("lists the initial capability surface as a markdown table", () => {
    const expectedCapabilities = [
      "recipes.search",
      "recipes.read",
      "recipes.dataset.inspect",
      "pantry.read",
      "pantry.reconcile",
      "cook_log.read",
      "cook_log.append",
      "cooking_insights.read",
      "recipe_import.create",
      "recipe_import.status",
    ];

    for (const capability of expectedCapabilities) {
      expect(
        adr.content.includes(`\`${capability}\``),
        `Expected capability table to reference "${capability}"`,
      ).toBe(true);
    }
  });

  it("links to other ADRs that exist in the repository", () => {
    const internalADRLinkPattern =
      /\(\/projects\/([a-z0-9-]+)\/adrs\/([a-z0-9-]+)\)/g;
    const referencedRefs = Array.from(
      adr.content.matchAll(internalADRLinkPattern),
    ).map(([, projectSlug, adrSlug]) => `${projectSlug}:${adrSlug}`);

    // Sanity check: the ADR does in fact link to ADR 032 and ADR 049.
    expect(referencedRefs).toContain("recipe-site:032-better-auth");
    expect(referencedRefs).toContain(
      "recipe-site:049-cloudflare-workflows-recipe-ingestion",
    );

    for (const referencedRef of referencedRefs) {
      expect(
        repo.adrs.has(referencedRef),
        `Linked ADR "${referencedRef}" should exist in the repository`,
      ).toBe(true);
    }
  });

  it("references the WorkOS auth.md alternative by name", () => {
    expect(adr.content).toContain("WorkOS");
    expect(adr.content).toContain("auth.md");
  });

  it("produces a readable summary via summarizeMarkdown", () => {
    const summary = summarizeMarkdown(adr.content);

    expect(summary.length).toBeGreaterThan(0);
    expect(summary.length).toBeLessThanOrEqual(280);
    // The summary should be flattened prose, not a raw heading or import line.
    expect(summary.startsWith("#")).toBe(false);
    expect(summary).toContain("Better Auth Agent Auth plugin");
  });

  it("parses the ADR ref back into its project and ADR slug", () => {
    expect(parseADRRef(adrRef)).toEqual({
      projectSlug: "recipe-site",
      adrSlug: "060-agent-auth",
    });
  });
});