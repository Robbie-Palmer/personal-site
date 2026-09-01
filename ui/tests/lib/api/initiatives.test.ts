import { describe, expect, it } from "vitest";
import {
  getAllInitiativeSlugs,
  getAllInitiatives,
  getInitiative,
  getInitiativesForProject,
} from "@/lib/api/initiatives";

describe("initiatives API", () => {
  it("loads initiatives with their ordered project contributions", () => {
    expect(getAllInitiativeSlugs()).toContain("personalized-medicine");

    const initiative = getInitiative("personalized-medicine");
    expect(initiative.projects.map((project) => project.slug)).toEqual([
      "ai-assisted-macrodissection",
      "genomic-prediction",
      "automated-macrodissection",
      "bioinformatics-platform",
      "pathology-viewer",
    ]);
    expect(initiative.projects[0]?.contribution).toMatch(
      /human-in-the-loop workflow/,
    );
    expect(getAllInitiatives()).toContainEqual(initiative);
  });

  it("finds initiative parents for a project", () => {
    expect(
      getInitiativesForProject("pathology-viewer").map(
        (initiative) => initiative.slug,
      ),
    ).toEqual(["personalized-medicine"]);
    expect(getInitiativesForProject("homelab")).toEqual([]);
  });

  it("rejects an unknown initiative", () => {
    expect(() => getInitiative("missing")).toThrow(
      "Initiative not found: missing",
    );
  });
});
