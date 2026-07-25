import { describe, expect, it } from "vitest";
import { getAllADRs, getProject, getProjectADR } from "@/lib/api/projects";

/**
 * Content tests for ADR 060 (Agent Auth for Delegated Recipe Access).
 *
 * This ADR is a new content file (ui/content/projects/recipe-site/adrs/060-agent-auth.mdx).
 * These tests verify it loads through the real domain repository with the expected
 * frontmatter, is correctly linked to its project/technologies, and that the internal
 * ADR links referenced in its body resolve to real content.
 */
describe("ADR 060: Agent Auth for Delegated Recipe Access", () => {
  const PROJECT_SLUG = "recipe-site";
  const ADR_SLUG = "060-agent-auth";

  it("loads via getProjectADR with the expected frontmatter", () => {
    const adr = getProjectADR(PROJECT_SLUG, ADR_SLUG);

    expect(adr.slug).toBe(ADR_SLUG);
    expect(adr.title).toBe("ADR 060: Agent Auth for Delegated Recipe Access");
    expect(adr.date).toBe("2026-07-25");
    expect(adr.status).toBe("Proposed");
    expect(adr.adrRef).toBe("recipe-site:060-agent-auth");
    expect(adr.projectSlug).toBe(PROJECT_SLUG);
    expect(adr.originProjectSlug).toBe(PROJECT_SLUG);
    expect(adr.originAdrSlug).toBe(ADR_SLUG);
    expect(adr.isInherited).toBe(false);
    expect(adr.supersedes).toBeUndefined();
  });

  it("reports a valid reading time", () => {
    const adr = getProjectADR(PROJECT_SLUG, ADR_SLUG);
    expect(typeof adr.readingTime).toBe("string");
    expect(adr.readingTime).toMatch(/^\d+ min read$/);
  });

  it("associates exactly the Better Auth technology from tech_stack", () => {
    const adr = getProjectADR(PROJECT_SLUG, ADR_SLUG);
    const techNames = adr.technologies.map((t) => t.name);
    expect(techNames).toEqual(["Better Auth"]);
    expect(adr.technologies[0]?.slug).toBe("better-auth");
  });

  it("includes the full raw markdown body with expected sections", () => {
    const adr = getProjectADR(PROJECT_SLUG, ADR_SLUG);
    const { content } = adr;

    for (const heading of [
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
    ]) {
      expect(content).toContain(heading);
    }
  });

  it("documents the initial capability surface", () => {
    const adr = getProjectADR(PROJECT_SLUG, ADR_SLUG);
    const { content } = adr;

    for (const capability of [
      "recipes.search",
      "recipes.dataset.inspect",
      "pantry.read",
      "pantry.reconcile",
      "cook_log.read",
      "cook_log.append",
      "cooking_insights.read",
      "recipe_import.create",
      "recipe_import.status",
    ]) {
      expect(content).toContain(capability);
    }
  });

  it("embeds a Mermaid sequence diagram of the delegated grant flow", () => {
    const adr = getProjectADR(PROJECT_SLUG, ADR_SLUG);
    expect(adr.content).toContain("<Mermaid");
    expect(adr.content).toContain("sequenceDiagram");
    expect(adr.content).toContain("Auth-->>A: Per-agent grant (no user session/API key)");
  });

  it("references ADR 032 and ADR 049 with links that resolve to real ADRs", () => {
    const adr = getProjectADR(PROJECT_SLUG, ADR_SLUG);

    // Extract every internal ADR link of the form
    // [label](/projects/<project-slug>/adrs/<adr-slug>) referenced in the body.
    const linkPattern = /\]\(\/projects\/([a-z0-9-]+)\/adrs\/([a-z0-9-]+)\)/g;
    const referencedADRs = Array.from(
      adr.content.matchAll(linkPattern),
      (match) => ({ projectSlug: match[1] as string, adrSlug: match[2] as string }),
    );

    expect(referencedADRs).toEqual(
      expect.arrayContaining([
        { projectSlug: "recipe-site", adrSlug: "032-better-auth" },
        {
          projectSlug: "recipe-site",
          adrSlug: "049-cloudflare-workflows-recipe-ingestion",
        },
      ]),
    );

    // Every internal link found in the body must resolve to a real, loadable ADR.
    for (const { projectSlug, adrSlug } of referencedADRs) {
      expect(() => getProjectADR(projectSlug, adrSlug)).not.toThrow();
    }
  });

  it("appears in getAllADRs with correct project context", () => {
    const allADRs = getAllADRs();
    const found = allADRs.find(
      (a) => a.projectSlug === PROJECT_SLUG && a.slug === ADR_SLUG,
    );

    expect(found).toBeDefined();
    expect(found?.title).toBe("ADR 060: Agent Auth for Delegated Recipe Access");
    expect(found?.projectTitle.length).toBeGreaterThan(0);
    expect(found?.status).toBe("Proposed");
  });

  it("appears in the recipe-site project's ADR list", () => {
    const project = getProject(PROJECT_SLUG);
    const found = project.adrs.find((a) => a.slug === ADR_SLUG);

    expect(found).toBeDefined();
    expect(found?.date).toBe("2026-07-25");
    expect(found?.status).toBe("Proposed");
  });

  it("is not resolvable under a different project's route", () => {
    const project = getProject(PROJECT_SLUG);
    const otherProject = getProject("personal-site");
    expect(otherProject.slug).not.toBe(project.slug);

    expect(() => getProjectADR(otherProject.slug, ADR_SLUG)).toThrow(
      "ADR not found",
    );
  });

  it("throws for a slug that does not exist under recipe-site", () => {
    expect(() => getProjectADR(PROJECT_SLUG, "060-agent-auth-nonexistent")).toThrow(
      "ADR not found",
    );
  });
});