import { describe, expect, it } from "vitest";
import {
  getAllADRs,
  getAllProjectSlugs,
  getAllProjects,
  getProject,
  getProjectADR,
} from "@/lib/projects";

/**
 * Projects tests - Integration tests for domain-backed project functions
 *
 * These tests verify that the project functions correctly use the domain repository.
 * The domain repository handles all validation, security, and file loading.
 * See tests/lib/domain/repository.test.ts for detailed validation tests.
 */
describe("Projects functions", () => {
  describe("getAllProjectSlugs", () => {
    it("should return array of project slugs", () => {
      const slugs = getAllProjectSlugs();
      expect(Array.isArray(slugs)).toBe(true);
      // Verify slugs are valid
      for (const slug of slugs) {
        expect(slug).toMatch(/^[a-z0-9_-]+$/);
      }
    });

    it("should return at least one project", () => {
      const slugs = getAllProjectSlugs();
      expect(slugs.length).toBeGreaterThan(0);
    });
  });

  describe("getProject", () => {
    it("should return project with all required fields", () => {
      const slugs = getAllProjectSlugs();
      expect(slugs.length).toBeGreaterThan(0);

      const project = getProject(slugs[0] ?? "");

      // Verify all required fields exist
      expect(project.slug).toBe(slugs[0]);
      expect(typeof project.title).toBe("string");
      expect(project.title.length).toBeGreaterThan(0);
      expect(typeof project.description).toBe("string");
      expect(project.description.length).toBeGreaterThan(0);
      expect(typeof project.date).toBe("string");
      expect(project.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Array.isArray(project.tech_stack)).toBe(true);
      expect(typeof project.content).toBe("string");
      expect(Array.isArray(project.adrs)).toBe(true);
      expect(["idea", "in_progress", "live", "archived"]).toContain(
        project.status,
      );
    });

    it("should throw error for non-existent project", () => {
      expect(() => getProject("non-existent-project-12345")).toThrow(
        "Project not found",
      );
    });

    it("should include ADRs for the project", () => {
      const slugs = getAllProjectSlugs();
      const project = getProject(slugs[0] ?? "");

      // Verify ADRs structure
      for (const adr of project.adrs) {
        expect(typeof adr.slug).toBe("string");
        expect(typeof adr.title).toBe("string");
        expect(typeof adr.date).toBe("string");
        expect(adr.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(["Accepted", "Rejected", "Deprecated", "Proposed"]).toContain(
          adr.status,
        );
        expect(typeof adr.content).toBe("string");
        expect(typeof adr.readingTime).toBe("string");
      }
    });

    it("should merge tech stack from accepted ADRs", () => {
      const projects = getAllProjects();

      // Find a project with accepted ADRs that have tech_stack
      const projectWithADRs = projects.find(
        (p) =>
          p.adrs.length > 0 &&
          p.adrs.some((adr) => adr.status === "Accepted" && adr.tech_stack),
      );

      if (!projectWithADRs) {
        // Skip test if no suitable project found
        return;
      }

      // Verify tech_stack includes technologies from accepted ADRs
      const acceptedADRTechs = projectWithADRs.adrs
        .filter((adr) => adr.status === "Accepted" && adr.tech_stack)
        .flatMap((adr) => adr.tech_stack || []);

      for (const tech of acceptedADRTechs) {
        expect(projectWithADRs.tech_stack).toContain(tech);
      }
    });
  });

  describe("getAllProjects", () => {
    it("should return array of all projects", () => {
      const projects = getAllProjects();
      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBeGreaterThan(0);
    });

    it("should return projects sorted by date (newest first)", () => {
      const projects = getAllProjects();
      if (projects.length < 2) {
        // Not enough projects to test sorting
        return;
      }

      for (let i = 0; i < projects.length - 1; i++) {
        const currentDate = new Date(projects[i]?.date ?? "").getTime();
        const nextDate = new Date(projects[i + 1]?.date ?? "").getTime();
        expect(currentDate).toBeGreaterThanOrEqual(nextDate);
      }
    });

    it("should return all projects from getAllProjectSlugs", () => {
      const slugs = getAllProjectSlugs();
      const projects = getAllProjects();

      expect(projects.length).toBe(slugs.length);

      const projectSlugs = projects.map((p) => p.slug);
      for (const slug of slugs) {
        expect(projectSlugs).toContain(slug);
      }
    });
  });

  describe("getProjectADR", () => {
    it("should return specific ADR from project", () => {
      const projects = getAllProjects();
      const projectWithADRs = projects.find((p) => p.adrs.length > 0);

      if (!projectWithADRs) {
        // Skip if no projects have ADRs
        return;
      }

      const firstADR = projectWithADRs.adrs[0];
      if (!firstADR) {
        return;
      }

      const adr = getProjectADR(projectWithADRs.slug, firstADR.slug);

      expect(adr.slug).toBe(firstADR.slug);
      expect(adr.title).toBe(firstADR.title);
      expect(adr.date).toBe(firstADR.date);
      expect(adr.status).toBe(firstADR.status);
    });

    it("should throw error for non-existent ADR", () => {
      const slugs = getAllProjectSlugs();
      if (slugs.length === 0) {
        return;
      }

      expect(() =>
        getProjectADR(slugs[0] ?? "", "non-existent-adr-12345"),
      ).toThrow("ADR not found");
    });

    it("should throw error if ADR belongs to different project", () => {
      const projects = getAllProjects();
      if (projects.length < 2) {
        // Need at least 2 projects
        return;
      }

      const project1 = projects[0];
      const project2 = projects[1];

      if (!project1?.adrs[0] || !project2) {
        return;
      }

      // Try to get project1's ADR using project2's slug
      expect(() =>
        getProjectADR(project2.slug, project1.adrs[0].slug),
      ).toThrow("does not belong to project");
    });
  });

  describe("getAllADRs", () => {
    it("should return all ADRs across all projects", () => {
      const adrs = getAllADRs();
      expect(Array.isArray(adrs)).toBe(true);
    });

    it("should include project context in each ADR", () => {
      const adrs = getAllADRs();

      if (adrs.length === 0) {
        // No ADRs to test
        return;
      }

      for (const adr of adrs) {
        expect(typeof adr.projectSlug).toBe("string");
        expect(typeof adr.projectTitle).toBe("string");
        expect(adr.projectSlug.length).toBeGreaterThan(0);
        expect(adr.projectTitle.length).toBeGreaterThan(0);
      }
    });

    it("should return ADRs sorted by date (newest first)", () => {
      const adrs = getAllADRs();
      if (adrs.length < 2) {
        return;
      }

      for (let i = 0; i < adrs.length - 1; i++) {
        const currentDate = new Date(adrs[i]?.date ?? "").getTime();
        const nextDate = new Date(adrs[i + 1]?.date ?? "").getTime();
        expect(currentDate).toBeGreaterThanOrEqual(nextDate);
      }
    });
  });
});
