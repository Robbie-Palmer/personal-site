import { beforeAll, describe, expect, it } from "vitest";
import {
  type DomainRepository,
  loadDomainRepository,
} from "@/lib/domain/repository";

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

  it("should have bidirectional technology relations", () => {
    // For each project, verify that its technologies reference it back
    for (const [projectSlug, project] of repo.projects) {
      for (const techSlug of project.relations.technologies) {
        const tech = repo.technologies.get(techSlug);
        expect(
          tech?.relations.projects.includes(projectSlug),
          `Tech ${techSlug} should reference project ${projectSlug}`,
        ).toBe(true);
      }
    }

    // For each ADR, verify that its technologies reference it back
    for (const [adrSlug, adr] of repo.adrs) {
      for (const techSlug of adr.relations.technologies) {
        const tech = repo.technologies.get(techSlug);
        expect(
          tech?.relations.adrs.includes(adrSlug),
          `Tech ${techSlug} should reference ADR ${adrSlug}`,
        ).toBe(true);
      }
    }

    // For each role, verify that its technologies reference it back
    for (const [roleSlug, role] of repo.roles) {
      for (const techSlug of role.relations.technologies) {
        const tech = repo.technologies.get(techSlug);
        expect(
          tech?.relations.roles.includes(roleSlug),
          `Tech ${techSlug} should reference role ${roleSlug}`,
        ).toBe(true);
      }
    }
  });

  it("should have consistent project-ADR relationships", () => {
    // For each project's ADRs, verify they reference the project back
    for (const [projectSlug, project] of repo.projects) {
      for (const adrSlug of project.relations.adrs) {
        const adr = repo.adrs.get(adrSlug);
        expect(
          adr?.relations.project,
          `ADR ${adrSlug} should reference project ${projectSlug}`,
        ).toBe(projectSlug);
      }
    }

    // For each ADR, verify its project lists it
    for (const [adrSlug, adr] of repo.adrs) {
      const project = repo.projects.get(adr.relations.project);
      expect(
        project?.relations.adrs.includes(adrSlug),
        `Project ${adr.relations.project} should reference ADR ${adrSlug}`,
      ).toBe(true);
    }
  });
});
