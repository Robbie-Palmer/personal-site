import { describe, expect, it } from "vitest";
import {
  buildContentGraph,
  createEmptyRelationData,
} from "@/lib/domain/graph/builder";
import {
  getContentUsingTechnology,
  getContentUsingTechnologyByType,
  getProjectForADR,
  getSupersededADR,
  getSupersedingADR,
  getTechnologiesForADR,
  getTechnologiesForBlog,
  getTechnologiesForProject,
  getTechnologiesForRole,
} from "@/lib/domain/graph/queries";
import {
  getNodeSlug,
  getNodeType,
  isNodeType,
  makeNodeId,
  parseNodeId,
} from "@/lib/domain/graph/types";

describe("NodeId utilities", () => {
  it("makeNodeId creates correct format", () => {
    expect(makeNodeId("project", "personal-site")).toBe(
      "project:personal-site",
    );
    expect(makeNodeId("technology", "typescript")).toBe(
      "technology:typescript",
    );
  });

  it("parseNodeId extracts type and slug", () => {
    const parsed = parseNodeId("project:personal-site");
    expect(parsed.type).toBe("project");
    expect(parsed.slug).toBe("personal-site");
  });

  it("parseNodeId handles slugs with colons", () => {
    const parsed = parseNodeId("blog:2025-01-01-my:post");
    expect(parsed.type).toBe("blog");
    expect(parsed.slug).toBe("2025-01-01-my:post");
  });

  it("getNodeType returns correct type", () => {
    expect(getNodeType("project:test")).toBe("project");
    expect(getNodeType("adr:001")).toBe("adr");
  });

  it("getNodeSlug returns correct slug", () => {
    expect(getNodeSlug("project:personal-site")).toBe("personal-site");
  });

  it("isNodeType correctly identifies types", () => {
    const nodeId = makeNodeId("project", "test");
    expect(isNodeType(nodeId, "project")).toBe(true);
    expect(isNodeType(nodeId, "adr")).toBe(false);
  });
});

describe("buildContentGraph", () => {
  it("builds technology edges for projects", () => {
    const relations = createEmptyRelationData();
    relations.projectTechnologies.set("site", ["typescript", "react"]);

    const graph = buildContentGraph({
      technologySlugs: ["typescript", "react"],
      projectSlugs: ["site"],
      relations,
    });

    const techs = graph.edges.usesTechnology.get("project:site");
    expect(techs).toBeDefined();
    expect(techs?.has("typescript")).toBe(true);
    expect(techs?.has("react")).toBe(true);
  });

  it("builds reverse edges for technologies", () => {
    const relations = createEmptyRelationData();
    relations.projectTechnologies.set("site", ["typescript"]);
    relations.adrTechnologies.set("001", ["typescript"]);
    relations.adrProject.set("001", "site");
    relations.blogTechnologies.set("post", ["typescript"]);
    relations.roleTechnologies.set("eng", ["typescript"]);

    const graph = buildContentGraph({
      technologySlugs: ["typescript"],
      projectSlugs: ["site"],
      relations,
    });

    const usedBy = graph.reverse.technologyUsedBy.get("typescript");
    expect(usedBy).toBeDefined();
    expect(usedBy?.has("project:site")).toBe(true);
    expect(usedBy?.has("adr:001")).toBe(true);
    expect(usedBy?.has("blog:post")).toBe(true);
    expect(usedBy?.has("role:eng")).toBe(true);
  });

  it("builds ADR-project edges", () => {
    const relations = createEmptyRelationData();
    relations.projectADRs.set("site", ["001", "002"]);
    relations.adrProject.set("001", "site");
    relations.adrProject.set("002", "site");

    const graph = buildContentGraph({
      technologySlugs: [],
      projectSlugs: ["site"],
      relations,
    });

    expect(graph.edges.partOfProject.get("001")).toBe("site");
    expect(graph.edges.partOfProject.get("002")).toBe("site");
    expect(graph.reverse.projectADRs.get("site")?.has("001")).toBe(true);
    expect(graph.reverse.projectADRs.get("site")?.has("002")).toBe(true);
  });

  it("builds supersedes edges", () => {
    const relations = createEmptyRelationData();
    relations.adrProject.set("001", "site");
    relations.adrProject.set("002", "site");
    relations.adrSupersededBy.set("002", "001");

    const graph = buildContentGraph({
      technologySlugs: [],
      projectSlugs: ["site"],
      relations,
    });

    expect(graph.edges.supersedes.get("002")).toBe("001");
    expect(graph.reverse.supersededBy.get("001")).toBe("002");
  });

  it("builds tag edges for blogs", () => {
    const relations = createEmptyRelationData();
    relations.blogTags.set("post", ["javascript", "react"]);

    const graph = buildContentGraph({
      technologySlugs: [],
      projectSlugs: [],
      relations,
    });

    expect(graph.edges.hasTag.get("blog:post")?.has("javascript")).toBe(true);
    expect(graph.edges.hasTag.get("blog:post")?.has("react")).toBe(true);
    expect(graph.reverse.tagUsedBy.get("javascript")?.has("blog:post")).toBe(
      true,
    );
  });
});

describe("graph queries", () => {
  const relations = createEmptyRelationData();
  relations.projectTechnologies.set("site", ["typescript", "react"]);
  relations.adrTechnologies.set("001", ["typescript"]);
  relations.adrProject.set("001", "site");
  relations.blogTechnologies.set("post", ["react"]);
  relations.roleTechnologies.set("eng", ["typescript", "react"]);

  const graph = buildContentGraph({
    technologySlugs: ["typescript", "react"],
    projectSlugs: ["site"],
    relations,
  });

  it("getTechnologiesForProject returns correct technologies", () => {
    const techs = getTechnologiesForProject(graph, "site");
    expect(techs.has("typescript")).toBe(true);
    expect(techs.has("react")).toBe(true);
  });

  it("getTechnologiesForADR returns correct technologies", () => {
    const techs = getTechnologiesForADR(graph, "001");
    expect(techs.has("typescript")).toBe(true);
    expect(techs.has("react")).toBe(false);
  });

  it("getTechnologiesForBlog returns correct technologies", () => {
    const techs = getTechnologiesForBlog(graph, "post");
    expect(techs.has("react")).toBe(true);
    expect(techs.has("typescript")).toBe(false);
  });

  it("getTechnologiesForRole returns correct technologies", () => {
    const techs = getTechnologiesForRole(graph, "eng");
    expect(techs.has("typescript")).toBe(true);
    expect(techs.has("react")).toBe(true);
  });

  it("getContentUsingTechnology returns all content using a tech", () => {
    const content = getContentUsingTechnology(graph, "typescript");
    expect(content.has("project:site")).toBe(true);
    expect(content.has("adr:001")).toBe(true);
    expect(content.has("role:eng")).toBe(true);
    expect(content.has("blog:post")).toBe(false);
  });

  it("getContentUsingTechnologyByType returns grouped content", () => {
    const content = getContentUsingTechnologyByType(graph, "typescript");
    expect(content.projects).toContain("site");
    expect(content.adrs).toContain("001");
    expect(content.roles).toContain("eng");
    expect(content.blogs).toHaveLength(0);
  });

  it("getProjectForADR returns correct project", () => {
    expect(getProjectForADR(graph, "001")).toBe("site");
  });

  it("supersedes queries work correctly", () => {
    const relations2 = createEmptyRelationData();
    relations2.adrProject.set("001", "site");
    relations2.adrProject.set("002", "site");
    relations2.adrSupersededBy.set("002", "001");

    const graph2 = buildContentGraph({
      technologySlugs: [],
      projectSlugs: ["site"],
      relations: relations2,
    });

    expect(getSupersedingADR(graph2, "001")).toBe("002");
    expect(getSupersededADR(graph2, "002")).toBe("001");
  });

  it("returns empty set for non-existent entities", () => {
    expect(getTechnologiesForProject(graph, "nonexistent").size).toBe(0);
    expect(getContentUsingTechnology(graph, "nonexistent").size).toBe(0);
  });
});
