import { describe, expect, it } from "vitest";
import type { GraphNode } from "@/lib/api/graph-data";
import { calculateGraphLayout } from "@/lib/domain/technology/graphLayout";

const nodes: GraphNode[] = [
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
    connections: 2,
  },
  {
    id: "technology:typescript",
    name: "TypeScript",
    type: "technology",
    href: "/technologies/typescript",
    connections: 1,
  },
  {
    id: "tag:web",
    name: "#web",
    type: "tag",
    href: "#",
    connections: 1,
  },
];

describe("calculateGraphLayout", () => {
  it("centres each visible filter result and marks hidden nodes absent", () => {
    const visibleNodeIds = new Set([
      "technology:react",
      "technology:typescript",
      "tag:web",
    ]);

    const positions = calculateGraphLayout(nodes, visibleNodeIds);
    const visiblePositions = [1, 2, 3].map((index) => [
      positions[index * 2],
      positions[index * 2 + 1],
    ]);

    expect(Number.isNaN(positions[0])).toBe(true);
    expect(Number.isNaN(positions[1])).toBe(true);
    expect(
      visiblePositions.reduce((sum, [x]) => sum + (x ?? 0), 0) /
        visiblePositions.length,
    ).toBeCloseTo(0);
    expect(
      visiblePositions.reduce((sum, [, y]) => sum + (y ?? 0), 0) /
        visiblePositions.length,
    ).toBeCloseTo(0);
  });

  it("calculates new coordinates when the visible composition changes", () => {
    const allNodeIds = new Set(nodes.map((node) => node.id));
    const technologyNodeIds = new Set(
      nodes.filter((node) => node.type === "technology").map((node) => node.id),
    );

    const fullLayout = calculateGraphLayout(nodes, allNodeIds);
    const filteredLayout = calculateGraphLayout(nodes, technologyNodeIds);

    expect([...filteredLayout.slice(2, 6)]).not.toEqual([
      ...fullLayout.slice(2, 6),
    ]);
  });

  it("returns the same positions for the same filter state", () => {
    const visibleNodeIds = new Set(nodes.map((node) => node.id));

    expect([...calculateGraphLayout(nodes, visibleNodeIds)]).toEqual([
      ...calculateGraphLayout(nodes, visibleNodeIds),
    ]);
  });
});
