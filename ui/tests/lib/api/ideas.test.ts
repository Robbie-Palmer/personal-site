import { describe, expect, it } from "vitest";
import {
  getAllIdeaSlugs,
  getAllIdeas,
  getIdea,
  getIdeasForADR,
  getIdeasForBlog,
  getIdeasForProject,
} from "@/lib/api/ideas";

describe("ideas API", () => {
  it("lists every idea with canonical reference counts", () => {
    expect(getAllIdeaSlugs()).toHaveLength(11);

    const ideas = getAllIdeas();
    expect(ideas.map((idea) => idea.title)).toEqual(
      [...ideas.map((idea) => idea.title)].sort((a, b) => a.localeCompare(b)),
    );
    expect(ideas).toContainEqual(
      expect.objectContaining({
        slug: "goodharts-law",
        referenceCount: 9,
      }),
    );
  });

  it("loads one idea with related ideas and backlinks", () => {
    const idea = getIdea("goodharts-law");
    if (!idea) throw new Error("Expected Goodhart's Law to exist");

    expect(idea.relatedIdeas.map((related) => related.slug)).toEqual([
      "dora-metrics",
      "jevons-paradox",
    ]);
    expect(idea.relatedContent.projects.map((project) => project.slug)).toEqual(
      ["agentic-code-review"],
    );
    expect(idea.relatedContent.blogs.map((post) => post.slug)).toEqual([
      "2026-08-18-crossing-the-chasm-with-ai-platform-teams",
    ]);
    expect(idea.relatedContent.adrs).toHaveLength(7);
    expect(idea.relatedContent.adrs).toContainEqual(
      expect.objectContaining({
        slug: "049-zizmor",
        projectSlug: "personal-site",
      }),
    );
  });

  it("finds ideas attached to projects, posts, and ADRs", () => {
    expect(
      getIdeasForProject("agentic-code-review").map((idea) => idea.slug),
    ).toEqual(["dora-metrics", "goodharts-law"]);
    expect(
      getIdeasForProject("autonomic-satellite-swarm").map((idea) => idea.slug),
    ).toEqual(["flp-impossibility", "two-generals-problem"]);
    expect(
      getIdeasForBlog(
        "2026-08-18-crossing-the-chasm-with-ai-platform-teams",
      ).map((idea) => idea.slug),
    ).toEqual(["goodharts-law", "reverse-conway-maneuver"]);
    expect(
      getIdeasForADR("recipe-site:045-sonarqube").map((idea) => idea.slug),
    ).toEqual(["goodharts-law"]);
  });

  it("returns null and empty links for unknown content", () => {
    expect(getIdea("missing")).toBeNull();
    expect(getIdeasForProject("missing")).toEqual([]);
    expect(getIdeasForBlog("missing")).toEqual([]);
    expect(getIdeasForADR("missing:001")).toEqual([]);
  });
});
