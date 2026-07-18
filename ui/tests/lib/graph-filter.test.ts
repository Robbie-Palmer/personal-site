import { describe, expect, it } from "vitest";
import type { GraphData } from "@/lib/api/graph-data";
import { filterGraphData } from "@/lib/domain/technology/graphFilter";

const data: GraphData = {
  nodes: [
    {
      id: "role:engineer",
      name: "Engineer",
      type: "role",
      href: "/experience#engineer",
      connections: 2,
    },
    {
      id: "project:site",
      name: "Site",
      type: "project",
      href: "/projects/site",
      connections: 2,
    },
    {
      id: "technology:react",
      name: "React",
      type: "technology",
      href: "/technologies/react",
      connections: 1,
    },
    {
      id: "tag:web",
      name: "#web",
      type: "tag",
      href: "#",
      connections: 1,
    },
  ],
  edges: [
    {
      source: "project:site",
      target: "role:engineer",
      type: "CREATED_AT_ROLE",
    },
    {
      source: "project:site",
      target: "technology:react",
      type: "USES_TECHNOLOGY",
    },
    { source: "role:engineer", target: "tag:web", type: "HAS_TAG" },
  ],
};

describe("filterGraphData", () => {
  it("synthesizes technology links through hidden context nodes", () => {
    const filtered = filterGraphData(data, new Set(["project"]), 0);

    expect(filtered.edges).toContainEqual({
      source: "role:engineer",
      target: "technology:react",
      type: "USES_TECHNOLOGY",
    });
    expect(filtered.nodes.find((node) => node.id === "role:engineer")).toEqual(
      expect.objectContaining({ connections: 2, totalConnections: 2 }),
    );
  });

  it("does not traverse tags when synthesizing links", () => {
    const tagBridge: GraphData = {
      nodes: data.nodes,
      edges: [
        { source: "role:engineer", target: "tag:web", type: "HAS_TAG" },
        { source: "tag:web", target: "technology:react", type: "HAS_TAG" },
      ],
    };

    const filtered = filterGraphData(tagBridge, new Set(["tag"]), 0);

    expect(filtered.edges).toEqual([]);
  });
});
