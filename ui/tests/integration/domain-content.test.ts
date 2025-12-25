import { describe, expect, it } from "vitest";
import { loadDomainRepository } from "@/lib/domain";

/**
 * Integration test: Validate all real content against domain models
 *
 * This test uses the real filesystem to ensure all content files
 * pass Zod validation and referential integrity checks.
 */
describe("Domain Content Validation (Integration)", () => {
  it("should load all content and pass validation", () => {
    // This will throw if any validation fails
    const repo = loadDomainRepository();

    // Verify we loaded actual content
    expect(repo.blogs.size).toBeGreaterThan(0);
    expect(repo.projects.size).toBeGreaterThan(0);
    expect(repo.adrs.size).toBeGreaterThan(0);
    expect(repo.roles.size).toBeGreaterThan(0);
    expect(repo.technologies.size).toBeGreaterThan(0);

    // Verify no referential integrity errors
    expect(repo.referentialIntegrityErrors).toEqual([]);
  });

  it("should have valid blog posts", () => {
    const repo = loadDomainRepository();

    for (const [slug, blog] of repo.blogs) {
      // Verify required fields
      expect(blog.slug, `Blog ${slug}: slug is required`).toBe(slug);
      expect(blog.title, `Blog ${slug}: title is required`).toBeTruthy();
      expect(
        blog.description,
        `Blog ${slug}: description is required`,
      ).toBeTruthy();
      expect(blog.date, `Blog ${slug}: date is required`).toBeTruthy();
      expect(blog.content, `Blog ${slug}: content is required`).toBeTruthy();
      expect(
        blog.readingTime,
        `Blog ${slug}: readingTime is required`,
      ).toBeTruthy();

      // Verify date format
      expect(
        /^\d{4}-\d{2}-\d{2}$/.test(blog.date),
        `Blog ${slug}: date must be YYYY-MM-DD format`,
      ).toBe(true);

      // Verify image format
      expect(
        /^blog\/[a-z0-9_-]+-\d{4}-\d{2}-\d{2}$/.test(blog.image),
        `Blog ${slug}: image must be in format 'blog/{name}-YYYY-MM-DD'`,
      ).toBe(true);

      // Verify tags is an array
      expect(
        Array.isArray(blog.tags),
        `Blog ${slug}: tags must be an array`,
      ).toBe(true);

      // Verify technologies is an array
      expect(
        Array.isArray(blog.relations.technologies),
        `Blog ${slug}: relations.technologies must be an array`,
      ).toBe(true);
    }
  });

  it("should have valid projects", () => {
    const repo = loadDomainRepository();

    for (const [slug, project] of repo.projects) {
      // Verify required fields
      expect(project.slug, `Project ${slug}: slug is required`).toBe(slug);
      expect(project.title, `Project ${slug}: title is required`).toBeTruthy();
      expect(
        project.description,
        `Project ${slug}: description is required`,
      ).toBeTruthy();
      expect(project.date, `Project ${slug}: date is required`).toBeTruthy();
      expect(
        project.status,
        `Project ${slug}: status is required`,
      ).toBeTruthy();
      expect(
        project.content,
        `Project ${slug}: content is required`,
      ).toBeTruthy();

      // Verify status is valid
      expect(
        ["idea", "in_progress", "live", "archived"].includes(project.status),
        `Project ${slug}: status must be one of: idea, in_progress, live, archived`,
      ).toBe(true);

      // Verify technologies array is not empty
      expect(
        project.relations.technologies.length,
        `Project ${slug}: must have at least one technology`,
      ).toBeGreaterThan(0);

      // Verify ADRs array
      expect(
        Array.isArray(project.relations.adrs),
        `Project ${slug}: relations.adrs must be an array`,
      ).toBe(true);

      // Verify all ADRs exist
      for (const adrSlug of project.relations.adrs) {
        expect(
          repo.adrs.has(adrSlug),
          `Project ${slug}: ADR ${adrSlug} must exist`,
        ).toBe(true);
      }

      // Verify all technologies exist
      for (const techSlug of project.relations.technologies) {
        expect(
          repo.technologies.has(techSlug),
          `Project ${slug}: Technology ${techSlug} must exist`,
        ).toBe(true);
      }
    }
  });

  it("should have valid ADRs", () => {
    const repo = loadDomainRepository();

    for (const [slug, adr] of repo.adrs) {
      // Verify required fields
      expect(adr.slug, `ADR ${slug}: slug is required`).toBe(slug);
      expect(adr.title, `ADR ${slug}: title is required`).toBeTruthy();
      expect(adr.date, `ADR ${slug}: date is required`).toBeTruthy();
      expect(adr.status, `ADR ${slug}: status is required`).toBeTruthy();
      expect(adr.content, `ADR ${slug}: content is required`).toBeTruthy();

      // Verify status is valid
      expect(
        ["Accepted", "Rejected", "Deprecated", "Proposed"].includes(adr.status),
        `ADR ${slug}: status must be one of: Accepted, Rejected, Deprecated, Proposed`,
      ).toBe(true);

      // Verify project exists
      expect(
        repo.projects.has(adr.relations.project),
        `ADR ${slug}: Project ${adr.relations.project} must exist`,
      ).toBe(true);

      // Verify all technologies exist
      for (const techSlug of adr.relations.technologies) {
        expect(
          repo.technologies.has(techSlug),
          `ADR ${slug}: Technology ${techSlug} must exist`,
        ).toBe(true);
      }

      // Verify supersededBy reference if present
      if (adr.supersededBy) {
        expect(
          repo.adrs.has(adr.supersededBy),
          `ADR ${slug}: supersededBy ${adr.supersededBy} must exist`,
        ).toBe(true);
      }
    }
  });

  it("should have valid job roles", () => {
    const repo = loadDomainRepository();

    for (const [slug, role] of repo.roles) {
      // Verify required fields
      expect(role.slug, `Role ${slug}: slug is required`).toBe(slug);
      expect(role.company, `Role ${slug}: company is required`).toBeTruthy();
      expect(
        role.companyUrl,
        `Role ${slug}: companyUrl is required`,
      ).toBeTruthy();
      expect(role.title, `Role ${slug}: title is required`).toBeTruthy();
      expect(role.location, `Role ${slug}: location is required`).toBeTruthy();
      expect(
        role.startDate,
        `Role ${slug}: startDate is required`,
      ).toBeTruthy();
      expect(
        role.description,
        `Role ${slug}: description is required`,
      ).toBeTruthy();

      // Verify date format
      expect(
        /^\d{4}-\d{2}$/.test(role.startDate),
        `Role ${slug}: startDate must be YYYY-MM format`,
      ).toBe(true);

      if (role.endDate) {
        expect(
          /^\d{4}-\d{2}$/.test(role.endDate),
          `Role ${slug}: endDate must be YYYY-MM format`,
        ).toBe(true);
      }

      // Verify responsibilities is not empty
      expect(
        role.responsibilities.length,
        `Role ${slug}: must have at least one responsibility`,
      ).toBeGreaterThan(0);

      // Verify all technologies exist
      for (const techSlug of role.relations.technologies) {
        expect(
          repo.technologies.has(techSlug),
          `Role ${slug}: Technology ${techSlug} must exist`,
        ).toBe(true);
      }

      // Verify companyUrl is valid
      expect(
        () => new URL(role.companyUrl),
        `Role ${slug}: companyUrl must be a valid URL`,
      ).not.toThrow();
    }
  });

  it("should have valid technologies", () => {
    const repo = loadDomainRepository();

    for (const [slug, tech] of repo.technologies) {
      // Verify required fields
      expect(tech.slug, `Tech ${slug}: slug is required`).toBe(slug);
      expect(tech.name, `Tech ${slug}: name is required`).toBeTruthy();

      // Verify relations structure
      expect(
        Array.isArray(tech.relations.blogs),
        `Tech ${slug}: relations.blogs must be an array`,
      ).toBe(true);
      expect(
        Array.isArray(tech.relations.adrs),
        `Tech ${slug}: relations.adrs must be an array`,
      ).toBe(true);
      expect(
        Array.isArray(tech.relations.projects),
        `Tech ${slug}: relations.projects must be an array`,
      ).toBe(true);
      expect(
        Array.isArray(tech.relations.roles),
        `Tech ${slug}: relations.roles must be an array`,
      ).toBe(true);

      // Verify all referenced entities exist
      for (const blogSlug of tech.relations.blogs) {
        expect(
          repo.blogs.has(blogSlug),
          `Tech ${slug}: Blog ${blogSlug} must exist`,
        ).toBe(true);
      }

      for (const adrSlug of tech.relations.adrs) {
        expect(
          repo.adrs.has(adrSlug),
          `Tech ${slug}: ADR ${adrSlug} must exist`,
        ).toBe(true);
      }

      for (const projectSlug of tech.relations.projects) {
        expect(
          repo.projects.has(projectSlug),
          `Tech ${slug}: Project ${projectSlug} must exist`,
        ).toBe(true);
      }

      for (const roleSlug of tech.relations.roles) {
        expect(
          repo.roles.has(roleSlug),
          `Tech ${slug}: Role ${roleSlug} must exist`,
        ).toBe(true);
      }

      // Verify brandColor format if present
      if (tech.brandColor) {
        expect(
          /^#[0-9A-Fa-f]{6}$/.test(tech.brandColor),
          `Tech ${slug}: brandColor must be hex format #RRGGBB`,
        ).toBe(true);
      }

      // Verify website is valid URL if present
      if (tech.website) {
        expect(
          () => new URL(tech.website),
          `Tech ${slug}: website must be a valid URL`,
        ).not.toThrow();
      }
    }
  });

  it("should have bidirectional technology relations", () => {
    const repo = loadDomainRepository();

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
    const repo = loadDomainRepository();

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
