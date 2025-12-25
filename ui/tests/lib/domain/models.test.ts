import { describe, expect, it } from "vitest";
import {
  TechnologySchema,
  BlogPostSchema,
  ADRSchema,
  ProjectSchema,
  JobRoleSchema,
  ADRStatusSchema,
  ProjectStatusSchema,
} from "@/lib/domain/models";

describe("Domain Model Schemas", () => {
  describe("TechnologySchema", () => {
    it("should validate a complete technology object", () => {
      const validTech = {
        slug: "react",
        name: "React",
        description: "A JavaScript library for building user interfaces",
        website: "https://react.dev",
        brandColor: "#61DAFB",
        iconSlug: "react",
        relations: {
          blogs: ["my-blog"],
          adrs: ["001-react"],
          projects: ["my-project"],
          roles: ["microsoft-0"],
        },
      };

      const result = TechnologySchema.safeParse(validTech);
      expect(result.success).toBe(true);
    });

    it("should validate minimal technology object with defaults", () => {
      const minimalTech = {
        slug: "typescript",
        name: "TypeScript",
      };

      const result = TechnologySchema.safeParse(minimalTech);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.relations).toEqual({
          blogs: [],
          adrs: [],
          projects: [],
          roles: [],
        });
      }
    });

    it("should reject technology with invalid brandColor format", () => {
      const invalidTech = {
        slug: "react",
        name: "React",
        brandColor: "red", // Should be hex format
        relations: {
          blogs: [],
          adrs: [],
          projects: [],
          roles: [],
        },
      };

      const result = TechnologySchema.safeParse(invalidTech);
      expect(result.success).toBe(false);
    });

    it("should reject technology with invalid website URL", () => {
      const invalidTech = {
        slug: "react",
        name: "React",
        website: "not-a-valid-url",
        relations: {
          blogs: [],
          adrs: [],
          projects: [],
          roles: [],
        },
      };

      const result = TechnologySchema.safeParse(invalidTech);
      expect(result.success).toBe(false);
    });

    it("should reject technology with empty slug", () => {
      const invalidTech = {
        slug: "",
        name: "React",
      };

      const result = TechnologySchema.safeParse(invalidTech);
      expect(result.success).toBe(false);
    });

    it("should reject technology with empty name", () => {
      const invalidTech = {
        slug: "react",
        name: "",
      };

      const result = TechnologySchema.safeParse(invalidTech);
      expect(result.success).toBe(false);
    });
  });

  describe("BlogPostSchema", () => {
    it("should validate a complete blog post", () => {
      const validPost = {
        slug: "my-blog-post",
        title: "My Blog Post",
        description: "An interesting article",
        date: "2025-10-19",
        updated: "2025-10-20",
        tags: ["tech", "programming"],
        canonicalUrl: "https://example.com/original",
        content: "# Blog Content",
        readingTime: "5 min read",
        image: "blog/my-post-2025-10-19",
        imageAlt: "Blog post cover image",
        relations: {
          technologies: ["react", "typescript"],
        },
      };

      const result = BlogPostSchema.safeParse(validPost);
      expect(result.success).toBe(true);
    });

    it("should validate minimal blog post with defaults", () => {
      const minimalPost = {
        slug: "minimal-post",
        title: "Minimal Post",
        description: "A minimal post",
        date: "2025-01-01",
        content: "Content",
        readingTime: "1 min read",
        image: "blog/minimal-2025-01-01",
        imageAlt: "Image",
      };

      const result = BlogPostSchema.safeParse(minimalPost);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toEqual([]);
        expect(result.data.relations.technologies).toEqual([]);
      }
    });

    it("should reject blog post with invalid date format", () => {
      const invalidPost = {
        slug: "bad-date",
        title: "Bad Date",
        description: "Desc",
        date: "2025/10/19", // Wrong format
        content: "Content",
        readingTime: "1 min read",
        image: "blog/bad-2025-10-19",
        imageAlt: "Image",
      };

      const result = BlogPostSchema.safeParse(invalidPost);
      expect(result.success).toBe(false);
    });

    it("should reject blog post with invalid image ID format", () => {
      const invalidPost = {
        slug: "bad-image",
        title: "Bad Image",
        description: "Desc",
        date: "2025-10-19",
        content: "Content",
        readingTime: "1 min read",
        image: "invalid-format", // Wrong format
        imageAlt: "Image",
      };

      const result = BlogPostSchema.safeParse(invalidPost);
      expect(result.success).toBe(false);
    });

    it("should reject blog post with invalid canonical URL", () => {
      const invalidPost = {
        slug: "bad-url",
        title: "Bad URL",
        description: "Desc",
        date: "2025-10-19",
        canonicalUrl: "not-a-url",
        content: "Content",
        readingTime: "1 min read",
        image: "blog/bad-2025-10-19",
        imageAlt: "Image",
      };

      const result = BlogPostSchema.safeParse(invalidPost);
      expect(result.success).toBe(false);
    });
  });

  describe("ADRSchema", () => {
    it("should validate a complete ADR", () => {
      const validADR = {
        slug: "001-next-js",
        title: "ADR 001: Next.js",
        date: "2025-10-18",
        status: "Accepted" as const,
        supersededBy: "002-remix",
        content: "We decided to use Next.js",
        readingTime: "3 min read",
        relations: {
          project: "personal-site",
          technologies: ["nextjs", "react"],
        },
      };

      const result = ADRSchema.safeParse(validADR);
      expect(result.success).toBe(true);
    });

    it("should validate ADR with minimal fields", () => {
      const minimalADR = {
        slug: "001-minimal",
        title: "Minimal ADR",
        date: "2025-01-01",
        status: "Proposed" as const,
        content: "Content",
        readingTime: "1 min read",
        relations: {
          project: "test-project",
          technologies: [],
        },
      };

      const result = ADRSchema.safeParse(minimalADR);
      expect(result.success).toBe(true);
    });

    it("should reject ADR with invalid status", () => {
      const invalidADR = {
        slug: "001-bad",
        title: "Bad ADR",
        date: "2025-01-01",
        status: "Invalid", // Not a valid status
        content: "Content",
        readingTime: "1 min read",
        relations: {
          project: "test",
          technologies: [],
        },
      };

      const result = ADRSchema.safeParse(invalidADR);
      expect(result.success).toBe(false);
    });

    it("should validate all valid ADR statuses", () => {
      const statuses = ["Accepted", "Rejected", "Deprecated", "Proposed"];

      for (const status of statuses) {
        const result = ADRStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("ProjectSchema", () => {
    it("should validate a complete project", () => {
      const validProject = {
        slug: "personal-site",
        title: "Personal Site",
        description: "My portfolio",
        date: "2025-11-02",
        updated: "2025-12-15",
        status: "live" as const,
        repoUrl: "https://github.com/user/repo",
        demoUrl: "https://example.com",
        content: "# Overview",
        relations: {
          technologies: ["nextjs", "react", "typescript"],
          adrs: ["001-next-js", "002-react"],
        },
      };

      const result = ProjectSchema.safeParse(validProject);
      expect(result.success).toBe(true);
    });

    it("should reject project with empty tech stack", () => {
      const invalidProject = {
        slug: "bad-project",
        title: "Bad Project",
        description: "Desc",
        date: "2025-01-01",
        status: "idea" as const,
        content: "Content",
        relations: {
          technologies: [], // Must have at least one
          adrs: [],
        },
      };

      const result = ProjectSchema.safeParse(invalidProject);
      expect(result.success).toBe(false);
    });

    it("should reject project with invalid status", () => {
      const invalidProject = {
        slug: "bad-status",
        title: "Bad Status",
        description: "Desc",
        date: "2025-01-01",
        status: "invalid",
        content: "Content",
        relations: {
          technologies: ["react"],
          adrs: [],
        },
      };

      const result = ProjectSchema.safeParse(invalidProject);
      expect(result.success).toBe(false);
    });

    it("should validate all valid project statuses", () => {
      const statuses = ["idea", "in_progress", "live", "archived"];

      for (const status of statuses) {
        const result = ProjectStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    it("should reject project with invalid URLs", () => {
      const invalidProject = {
        slug: "bad-urls",
        title: "Bad URLs",
        description: "Desc",
        date: "2025-01-01",
        status: "live" as const,
        repoUrl: "not-a-url",
        demoUrl: "also-not-a-url",
        content: "Content",
        relations: {
          technologies: ["react"],
          adrs: [],
        },
      };

      const result = ProjectSchema.safeParse(invalidProject);
      expect(result.success).toBe(false);
    });
  });

  describe("JobRoleSchema", () => {
    it("should validate a complete job role", () => {
      const validRole = {
        slug: "microsoft-0",
        company: "Microsoft",
        companyUrl: "https://microsoft.com",
        logoPath: "/logos/microsoft.png",
        title: "Software Engineer",
        location: "Seattle, WA",
        startDate: "2020-01",
        endDate: "2022-06",
        description: "Worked on cool stuff",
        responsibilities: [
          "Built features",
          "Fixed bugs",
          "Wrote tests",
        ],
        relations: {
          technologies: ["csharp", "dotnet", "azure"],
        },
      };

      const result = JobRoleSchema.safeParse(validRole);
      expect(result.success).toBe(true);
    });

    it("should validate current role without endDate", () => {
      const currentRole = {
        slug: "current-role",
        company: "Current Co",
        companyUrl: "https://current.com",
        logoPath: "/logos/current.png",
        title: "Senior Engineer",
        location: "Remote",
        startDate: "2023-01",
        // No endDate for current role
        description: "Current position",
        responsibilities: ["Leading projects"],
        relations: {
          technologies: ["typescript", "react"],
        },
      };

      const result = JobRoleSchema.safeParse(currentRole);
      expect(result.success).toBe(true);
    });

    it("should reject role with invalid date format", () => {
      const invalidRole = {
        slug: "bad-date",
        company: "Bad Co",
        companyUrl: "https://bad.com",
        logoPath: "/logo.png",
        title: "Engineer",
        location: "Remote",
        startDate: "2020-01-01", // Wrong format (should be YYYY-MM)
        description: "Desc",
        responsibilities: ["Work"],
        relations: {
          technologies: [],
        },
      };

      const result = JobRoleSchema.safeParse(invalidRole);
      expect(result.success).toBe(false);
    });

    it("should reject role with invalid company URL", () => {
      const invalidRole = {
        slug: "bad-url",
        company: "Bad Co",
        companyUrl: "not-a-url",
        logoPath: "/logo.png",
        title: "Engineer",
        location: "Remote",
        startDate: "2020-01",
        description: "Desc",
        responsibilities: ["Work"],
        relations: {
          technologies: [],
        },
      };

      const result = JobRoleSchema.safeParse(invalidRole);
      expect(result.success).toBe(false);
    });

    it("should reject role with empty responsibilities", () => {
      const invalidRole = {
        slug: "no-resp",
        company: "No Resp Co",
        companyUrl: "https://noresp.com",
        logoPath: "/logo.png",
        title: "Engineer",
        location: "Remote",
        startDate: "2020-01",
        description: "Desc",
        responsibilities: [], // Must have at least one
        relations: {
          technologies: [],
        },
      };

      const result = JobRoleSchema.safeParse(invalidRole);
      expect(result.success).toBe(false);
    });
  });
});
