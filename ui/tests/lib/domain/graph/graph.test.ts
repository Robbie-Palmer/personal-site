import { describe, expect, it } from "vitest";
import type { ADR } from "@/lib/domain/adr/adr";
import type { BlogPost } from "@/lib/domain/blog/blogPost";
import { buildContentGraph } from "@/lib/domain/graph/builder";
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
import type { Project } from "@/lib/domain/project/project";
import type { JobRole } from "@/lib/domain/role/jobRole";
import type { Technology } from "@/lib/domain/technology/technology";

const createTechnology = (slug: string): Technology => ({
  slug,
  name: slug.charAt(0).toUpperCase() + slug.slice(1),
  description: undefined,
  website: undefined,
  brandColor: undefined,
  iconSlug: undefined,
});

const createProject = (
  slug: string,
  technologies: string[],
  adrs: string[] = [],
): Project => ({
  slug,
  title: slug,
  description: "Test project",
  date: "2025-01-01",
  updated: undefined,
  status: "live",
  repoUrl: undefined,
  demoUrl: undefined,
  content: "",
  relations: { technologies, adrs },
});

const createADR = (
  slug: string,
  project: string,
  technologies: string[],
  supersededBy?: string,
): ADR => ({
  slug,
  title: slug,
  date: "2025-01-01",
  status: "Accepted",
  supersededBy,
  content: "",
  readingTime: "1 min",
  relations: { project, technologies },
});

const createBlog = (slug: string, technologies: string[]): BlogPost => ({
  slug,
  title: slug,
  description: "Test blog",
  date: "2025-01-01",
  updated: undefined,
  tags: [],
  canonicalUrl: undefined,
  content: "",
  readingTime: "1 min",
  image: `blog/${slug}-2025-01-01`,
  imageAlt: "Test image",
  relations: { technologies },
});

const createRole = (slug: string, technologies: string[]): JobRole => ({
  slug,
  company: "Test Co",
  companyUrl: "https://example.com",
  logoPath: "/logos/test.png",
  title: "Engineer",
  location: "Remote",
  startDate: "2025-01",
  endDate: undefined,
  description: "Test role",
  responsibilities: [],
  relations: { technologies },
});

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
    const entities = {
      technologies: new Map([
        ["typescript", createTechnology("typescript")],
        ["react", createTechnology("react")],
      ]),
      projects: new Map([
        ["site", createProject("site", ["typescript", "react"])],
      ]),
      adrs: new Map(),
      blogs: new Map(),
      roles: new Map(),
    };

    const graph = buildContentGraph(entities);

    const techs = graph.edges.usesTechnology.get("project:site");
    expect(techs).toBeDefined();
    expect(techs?.has("typescript")).toBe(true);
    expect(techs?.has("react")).toBe(true);
  });

  it("builds reverse edges for technologies", () => {
    const entities = {
      technologies: new Map([["typescript", createTechnology("typescript")]]),
      projects: new Map([["site", createProject("site", ["typescript"])]]),
      adrs: new Map([["001", createADR("001", "site", ["typescript"])]]),
      blogs: new Map([["post", createBlog("post", ["typescript"])]]),
      roles: new Map([["eng", createRole("eng", ["typescript"])]]),
    };

    const graph = buildContentGraph(entities);

    const usedBy = graph.reverse.technologyUsedBy.get("typescript");
    expect(usedBy).toBeDefined();
    expect(usedBy?.has("project:site")).toBe(true);
    expect(usedBy?.has("adr:001")).toBe(true);
    expect(usedBy?.has("blog:post")).toBe(true);
    expect(usedBy?.has("role:eng")).toBe(true);
  });

  it("builds ADR-project edges", () => {
    const entities = {
      technologies: new Map(),
      projects: new Map([["site", createProject("site", [], ["001", "002"])]]),
      adrs: new Map([
        ["001", createADR("001", "site", [])],
        ["002", createADR("002", "site", [])],
      ]),
      blogs: new Map(),
      roles: new Map(),
    };

    const graph = buildContentGraph(entities);

    expect(graph.edges.partOfProject.get("001")).toBe("site");
    expect(graph.edges.partOfProject.get("002")).toBe("site");
    expect(graph.reverse.projectADRs.get("site")?.has("001")).toBe(true);
    expect(graph.reverse.projectADRs.get("site")?.has("002")).toBe(true);
  });

  it("builds supersedes edges", () => {
    const entities = {
      technologies: new Map(),
      projects: new Map([["site", createProject("site", [])]]),
      adrs: new Map([
        ["001", createADR("001", "site", [], "002")],
        ["002", createADR("002", "site", [])],
      ]),
      blogs: new Map(),
      roles: new Map(),
    };

    const graph = buildContentGraph(entities);

    expect(graph.edges.supersedes.get("002")).toBe("001");
    expect(graph.reverse.supersededBy.get("001")).toBe("002");
  });
});

describe("graph queries", () => {
  const entities = {
    technologies: new Map([
      ["typescript", createTechnology("typescript")],
      ["react", createTechnology("react")],
    ]),
    projects: new Map([
      ["site", createProject("site", ["typescript", "react"])],
    ]),
    adrs: new Map([["001", createADR("001", "site", ["typescript"])]]),
    blogs: new Map([["post", createBlog("post", ["react"])]]),
    roles: new Map([["eng", createRole("eng", ["typescript", "react"])]]),
  };

  const graph = buildContentGraph(entities);

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
    const entities2 = {
      ...entities,
      adrs: new Map([
        ["001", createADR("001", "site", [], "002")],
        ["002", createADR("002", "site", [])],
      ]),
    };
    const graph2 = buildContentGraph(entities2);

    expect(getSupersedingADR(graph2, "001")).toBe("002");
    expect(getSupersededADR(graph2, "002")).toBe("001");
  });

  it("returns empty set for non-existent entities", () => {
    expect(getTechnologiesForProject(graph, "nonexistent").size).toBe(0);
    expect(getContentUsingTechnology(graph, "nonexistent").size).toBe(0);
  });
});
