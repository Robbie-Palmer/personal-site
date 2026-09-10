import { describe, expect, it } from "vitest";
import { extractGraphData } from "@/lib/api/graph-data";
import type { DomainRepository } from "@/lib/domain";

describe("extractGraphData", () => {
  it("skips ADR nodes when project mapping is missing", () => {
    const repository = {
      technologies: new Map(),
      ideas: new Map([
        ["conways-law", { title: "Conway's Law" }],
        ["reverse-conway-maneuver", { title: "Reverse Conway Maneuver" }],
      ]),
      initiatives: new Map([
        ["software-development", { title: "Software Development" }],
      ]),
      projects: new Map([["site", { title: "Site" }]]),
      blogs: new Map(),
      roles: new Map(),
      adrs: new Map([
        ["site:001-react", { title: "ADR 001: React" }],
        ["site:999-missing", { title: "ADR 999: Missing" }],
      ]),
      graph: {
        edges: {
          usesTechnology: new Map(),
          contributesToInitiative: new Map([
            ["site", new Set(["software-development"])],
          ]),
          partOfProject: new Map([["site:001-react", "site"]]),
          supersedes: new Map(),
          inheritsFrom: new Map(),
          hasTag: new Map(),
          createdAtRole: new Map(),
          writtenAtRole: new Map(),
          referencesIdea: new Map([
            ["project:site", new Set(["conways-law", "missing-idea"])],
            ["blog:missing", new Set(["conways-law"])],
          ]),
          relatedIdea: new Map([
            [
              "conways-law",
              new Set(["reverse-conway-maneuver", "missing-idea"]),
            ],
            ["reverse-conway-maneuver", new Set(["conways-law"])],
            ["missing-idea", new Set(["reverse-conway-maneuver"])],
          ]),
        },
        reverse: {
          technologyUsedBy: new Map(),
          initiativeProjects: new Map(),
          projectADRs: new Map(),
          supersededBy: new Map(),
          inheritedBy: new Map(),
          tagUsedBy: new Map(),
          roleProjects: new Map(),
          roleBlogs: new Map(),
          ideaReferencedBy: new Map(),
        },
      },
      buildingPhilosophy: "",
      referentialIntegrityErrors: [],
    } as unknown as DomainRepository;

    const data = extractGraphData(repository);
    const adrNodeIds = data.nodes
      .filter((n) => n.type === "adr")
      .map((n) => n.id);

    expect(adrNodeIds).toContain("adr:site:001-react");
    expect(adrNodeIds).not.toContain("adr:site:999-missing");
    expect(data.nodes).toContainEqual(
      expect.objectContaining({
        id: "initiative:software-development",
        href: "/initiatives/software-development",
      }),
    );
    expect(data.edges).toContainEqual({
      source: "project:site",
      target: "initiative:software-development",
      type: "CONTRIBUTES_TO_INITIATIVE",
    });
    expect(data.nodes).toContainEqual(
      expect.objectContaining({
        id: "idea:conways-law",
        href: "/ideas/conways-law",
        connections: 2,
      }),
    );
    expect(data.edges).toContainEqual({
      source: "project:site",
      target: "idea:conways-law",
      type: "REFERENCES_IDEA",
    });
    expect(data.edges).toContainEqual({
      source: "idea:conways-law",
      target: "idea:reverse-conway-maneuver",
      type: "RELATED_IDEA",
    });
    expect(
      data.edges.filter((edge) => edge.type === "RELATED_IDEA"),
    ).toHaveLength(1);
    expect(data.edges).not.toContainEqual(
      expect.objectContaining({ target: "idea:missing-idea" }),
    );
  });
});
