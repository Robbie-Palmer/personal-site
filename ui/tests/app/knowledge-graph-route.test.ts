import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/knowledge-graph.json/route";

const repository = vi.hoisted(() => ({ id: "repository" }));
const graphData = vi.hoisted(() => ({
  nodes: [],
  edges: [],
}));
const extractGraphData = vi.hoisted(() => vi.fn(() => graphData));
const loadDomainRepository = vi.hoisted(() => vi.fn(() => repository));

vi.mock("@/lib/api/graph-data", () => ({ extractGraphData }));
vi.mock("@/lib/domain", () => ({ loadDomainRepository }));

describe("knowledge graph data route", () => {
  it("returns the extracted site graph", async () => {
    const response = GET();

    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual(graphData);
    expect(loadDomainRepository).toHaveBeenCalledOnce();
    expect(extractGraphData).toHaveBeenCalledWith(repository);
  });
});
