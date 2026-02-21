import { beforeAll, describe, expect, it } from "vitest";
import {
  type DomainRepository,
  getADRSlugsForProject,
  getProjectForADR,
  getTechnologiesForADR,
  getTechnologiesForProject,
  getTechnologiesForRole,
  loadDomainRepository,
} from "@/lib/repository";

/**
 * Integration test: Validate all real content against domain models
 *
 * loadDomainRepository() already validates all content against Zod schemas
 * and checks referential integrity (throwing on any errors). These tests
 * verify content loaded successfully and that bidirectional relations
 * were built correctly.
 */
describe("Domain Content Validation (Integration)", () => {
  let repo: DomainRepository;

  beforeAll(() => {
    // Throws if any schema validation or referential integrity check fails
    repo = loadDomainRepository();
  });

  it("should load all content and pass validation", () => {
    expect(repo.blogs.size).toBeGreaterThan(0);
    expect(repo.projects.size).toBeGreaterThan(0);
    expect(repo.adrs.size).toBeGreaterThan(0);
    expect(repo.roles.size).toBeGreaterThan(0);
    expect(repo.technologies.size).toBeGreaterThan(0);
    expect(repo.referentialIntegrityErrors).toEqual([]);
  });

  it("should have bidirectional technology relations in graph", () => {
    // For each project, verify that the graph has reverse references
    for (const [projectSlug] of repo.projects) {
      const techSlugs = getTechnologiesForProject(repo.graph, projectSlug);
      for (const techSlug of techSlugs) {
        const usedBy = repo.graph.reverse.technologyUsedBy.get(techSlug);
        expect(
          usedBy?.has(`project:${projectSlug}`),
          `Tech ${techSlug} should reference project ${projectSlug} in graph`,
        ).toBe(true);
      }
    }

    // For each ADR, verify that the graph has reverse references
    for (const [adrSlug] of repo.adrs) {
      const techSlugs = getTechnologiesForADR(repo.graph, adrSlug);
      for (const techSlug of techSlugs) {
        const usedBy = repo.graph.reverse.technologyUsedBy.get(techSlug);
        expect(
          usedBy?.has(`adr:${adrSlug}`),
          `Tech ${techSlug} should reference ADR ${adrSlug} in graph`,
        ).toBe(true);
      }
    }

    // For each role, verify that the graph has reverse references
    for (const [roleSlug] of repo.roles) {
      const techSlugs = getTechnologiesForRole(repo.graph, roleSlug);
      for (const techSlug of techSlugs) {
        const usedBy = repo.graph.reverse.technologyUsedBy.get(techSlug);
        expect(
          usedBy?.has(`role:${roleSlug}`),
          `Tech ${techSlug} should reference role ${roleSlug} in graph`,
        ).toBe(true);
      }
    }
  });

  it("should have consistent project-ADR relationships", () => {
    // For each project's ADRs, verify owner exists (can differ for inherited ADRs)
    for (const [projectSlug] of repo.projects) {
      const adrSlugs = getADRSlugsForProject(repo.graph, projectSlug);
      for (const adrSlug of adrSlugs) {
        const adrProject = getProjectForADR(repo.graph, adrSlug);
        expect(
          adrProject,
          `ADR ${adrSlug} should have an owning project`,
        ).toBeDefined();
      }
    }

    // For each ADR, verify its project lists it
    for (const [adrSlug] of repo.adrs) {
      const projectSlug = getProjectForADR(repo.graph, adrSlug);
      expect(projectSlug).toBeDefined();
      const projectADRs = getADRSlugsForProject(repo.graph, projectSlug!);
      expect(
        projectADRs.includes(adrSlug),
        `Project ${projectSlug} should reference ADR ${adrSlug}`,
      ).toBe(true);
    }
  });
});
