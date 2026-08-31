import { describe, expect, it } from "vitest";
import type { DomainRepository } from "@/lib/domain";
import {
  getAllInitiatives,
  getInitiative,
  getInitiativeProjects,
  getProjectInitiatives,
} from "@/lib/domain/initiative";
import { buildContentGraph, createEmptyRelationData } from "@/lib/repository";

function makeRepository(): DomainRepository {
  const initiative = {
    slug: "personalized-medicine",
    title: "Personalized Medicine",
    description: "Patient-specific treatment decisions",
    content: "# Goal",
  };
  const project = {
    slug: "pathology-viewer",
    title: "Pathology Viewer",
    description: "View digital pathology slides",
    date: "2021-11-01",
    status: "completed" as const,
    content: "# Vision",
  };
  const relations = createEmptyRelationData();
  relations.projectInitiatives.set(project.slug, [
    initiative.slug,
    "missing-initiative",
  ]);
  const graph = buildContentGraph({
    technologySlugs: [],
    projectSlugs: [project.slug],
    initiativeSlugs: [initiative.slug],
    relations,
  });
  graph.reverse.initiativeProjects.get(initiative.slug)?.add("missing-project");

  return {
    initiatives: new Map([[initiative.slug, initiative]]),
    projects: new Map([[project.slug, project]]),
    graph,
  } as unknown as DomainRepository;
}

describe("initiative queries", () => {
  it("gets one initiative or null", () => {
    const repository = makeRepository();

    expect(getInitiative(repository, "personalized-medicine")?.title).toBe(
      "Personalized Medicine",
    );
    expect(getInitiative(repository, "missing-initiative")).toBeNull();
  });

  it("lists all initiatives", () => {
    const repository = makeRepository();

    expect(getAllInitiatives(repository).map(({ slug }) => slug)).toEqual([
      "personalized-medicine",
    ]);
  });

  it("resolves initiative projects and drops missing entities", () => {
    const repository = makeRepository();

    expect(
      getInitiativeProjects(repository, "personalized-medicine").map(
        ({ slug }) => slug,
      ),
    ).toEqual(["pathology-viewer"]);
  });

  it("resolves project initiatives and drops missing entities", () => {
    const repository = makeRepository();

    expect(
      getProjectInitiatives(repository, "pathology-viewer").map(
        ({ slug }) => slug,
      ),
    ).toEqual(["personalized-medicine"]);
  });
});
