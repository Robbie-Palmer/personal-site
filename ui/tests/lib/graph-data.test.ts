import { describe, expect, it } from "vitest";
import { extractGraphData } from "@/lib/api/graph-data";
import type { DomainRepository } from "@/lib/domain";

describe("extractGraphData", () => {
  it("skips ADR nodes when project mapping is missing", () => {
    const repository = {
      technologies: new Map(),
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
  });
});
