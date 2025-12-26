import type { Dirent } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

type ReaddirResult = ReturnType<typeof import("node:fs").readdirSync>;

function mockDirent(name: string, isDir = true): Dirent {
  return { name, isDirectory: () => isDir } as Dirent;
}

// Hoist mocks before importing code under test
const fsMock = vi.hoisted(() => {
  const existsSync = vi.fn();
  const readdirSync = vi.fn();
  const readFileSync = vi.fn();

  return {
    default: { existsSync, readdirSync, readFileSync },
    existsSync,
    readdirSync,
    readFileSync,
  };
});

const pathMock = vi.hoisted(() => {
  const join = vi.fn((...args: string[]) => args.join("/"));
  return {
    default: { join },
    join,
  };
});

const experienceMock = vi.hoisted(() => ({
  getAllExperience: vi.fn(),
  getExperienceSlug: vi.fn((exp: { company: string }) =>
    exp.company.toLowerCase().replace(/\s+/g, "-"),
  ),
}));

vi.mock("fs", () => fsMock);
vi.mock("path", () => pathMock);
vi.mock("@/lib/experience", () => experienceMock);

// Import after mocks are hoisted
import * as fs from "node:fs";
import {
  buildTechnologyRelations,
  loadADRs,
  loadBlogPosts,
  loadJobRoles,
  loadProjects,
  loadTechnologies,
  validateBlogPost,
  validateReferentialIntegrity,
  validateTechnology,
} from "@/lib/domain/repository";

describe("Domain Repository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  describe("loadBlogPosts", () => {
    it("should return empty map when blog directory does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const blogs = loadBlogPosts();

      expect(blogs.size).toBe(0);
    });

    it("should load and validate blog posts", () => {
      const mockBlogContent = `---
title: "Test Post"
description: "A test post"
date: "2025-10-19"
tags: ["test"]
image: "blog/test-2025-10-19"
imageAlt: "Test image"
---

# Content here`;

      vi.mocked(fs.readdirSync).mockReturnValue([
        "test-post.mdx",
      ] as unknown as ReaddirResult);
      vi.mocked(fs.readFileSync).mockReturnValue(mockBlogContent);

      const blogs = loadBlogPosts();

      expect(blogs.size).toBe(1);
      const post = blogs.get("test-post");
      expect(post).toBeDefined();
      expect(post?.title).toBe("Test Post");
      expect(post?.slug).toBe("test-post");
    });

    it("should exclude README.mdx files", () => {
      vi.mocked(fs.readdirSync).mockReturnValue([
        "post.mdx",
        "README.mdx",
      ] as unknown as ReaddirResult);

      const mockContent = `---
title: "Test"
description: "Test"
date: "2025-01-01"
tags: []
image: "blog/test-2025-01-01"
imageAlt: "Test"
---
Content`;

      vi.mocked(fs.readFileSync).mockReturnValue(mockContent);

      const blogs = loadBlogPosts();

      expect(blogs.size).toBe(1);
      expect(blogs.has("post")).toBe(true);
      expect(blogs.has("README")).toBe(false);
    });
  });

  describe("loadProjects", () => {
    it("should return empty map when projects directory does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const projects = loadProjects();

      expect(projects.size).toBe(0);
    });

    it("should load and validate projects", () => {
      const mockProjectContent = `---
title: "Test Project"
description: "A test project"
date: "2025-01-01"
status: "live"
tech_stack: ["React", "TypeScript"]
---

# Project content`;

      vi.mocked(fs.readdirSync).mockImplementation(((path: string) => {
        if (path.endsWith("projects")) return [mockDirent("test-project")];
        return [];
      }) as unknown as typeof fs.readdirSync);
      vi.mocked(fs.readFileSync).mockReturnValue(mockProjectContent);

      const projects = loadProjects();

      expect(projects.size).toBe(1);
      const project = projects.get("test-project");
      expect(project).toBeDefined();
      expect(project?.title).toBe("Test Project");
      expect(project?.relations.technologies).toEqual(["react", "typescript"]);
    });

    it("should load ADRs for each project", () => {
      const mockProjectContent = `---
title: "Test Project"
description: "A test project"
date: "2025-01-01"
status: "live"
tech_stack: ["React"]
---
Content`;
      const mockADRContent = `---
title: "ADR 001"
date: "2025-01-01"
status: "Accepted"
tech_stack: ["TypeScript"]
---
Content`;

      vi.mocked(fs.existsSync).mockImplementation(() => {
        return true;
      });

      vi.mocked(fs.readdirSync).mockImplementation(((path: string) => {
        if (path.endsWith("projects")) return [mockDirent("test-project")];
        if (path.includes("adrs")) return ["001-test.mdx"];
        return [];
      }) as unknown as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr.includes("index.mdx")) {
          return mockProjectContent;
        }
        if (pathStr.includes("001-test.mdx")) {
          return mockADRContent;
        }
        return "";
      });

      const projects = loadProjects();

      expect(projects.size).toBe(1);
      const project = projects.get("test-project");
      expect(project?.relations.adrs).toEqual(["001-test"]);
    });
  });

  describe("loadADRs", () => {
    it("should return empty map when projects directory does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const adrs = loadADRs();

      expect(adrs.size).toBe(0);
    });

    it("should load ADRs from all projects", () => {
      const mockADRContent = `---
title: "ADR 001: Use React"
date: "2025-01-01"
status: "Accepted"
tech_stack: ["React"]
---

We decided to use React.`;

      vi.mocked(fs.readdirSync).mockImplementation(((path: string) => {
        if (path.endsWith("projects")) return [mockDirent("project-1")];
        if (path.includes("adrs")) return ["001-react.mdx"];
        return [];
      }) as unknown as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(mockADRContent);

      const adrs = loadADRs();

      expect(adrs.size).toBe(1);
      const adr = adrs.get("001-react");
      expect(adr).toBeDefined();
      expect(adr?.title).toBe("ADR 001: Use React");
      expect(adr?.relations.project).toBe("project-1");
      expect(adr?.relations.technologies).toEqual(["react"]);
    });
  });

  describe("loadJobRoles", () => {
    it("should load roles from getAllExperience", () => {
      const mockExperiences = [
        {
          company: "Microsoft",
          company_url: "https://microsoft.com",
          logo_path: "/logos/microsoft.png",
          title: "Software Engineer",
          location: "Seattle, WA",
          startDate: "2020-01",
          endDate: "2022-06",
          description: "Worked on cool stuff",
          responsibilities: ["Built features"],
          technologies: ["C#", "Azure"],
        },
      ];

      vi.mocked(experienceMock.getAllExperience).mockReturnValue(
        mockExperiences,
      );

      const roles = loadJobRoles();

      expect(roles.size).toBe(1);
      const role = Array.from(roles.values())[0];
      expect(role).toBeDefined();
      expect(role?.company).toBe("Microsoft");
      expect(role?.relations.technologies).toEqual(["c#", "azure"]);
    });
  });

  describe("loadTechnologies", () => {
    it("should build technology catalog from all content", () => {
      const mockExperiences = [
        {
          company: "Test Co",
          company_url: "https://test.com",
          logo_path: "/logo.png",
          title: "Engineer",
          location: "Remote",
          startDate: "2020-01",
          endDate: "2022-01",
          description: "Desc",
          responsibilities: ["Work"],
          technologies: ["React", "TypeScript"],
        },
      ];

      const mockProjectContent = `---
title: "Project"
description: "Desc"
date: "2025-01-01"
status: "live"
tech_stack: ["Next.js", "React"]
---
Content`;

      vi.mocked(experienceMock.getAllExperience).mockReturnValue(
        mockExperiences,
      );

      vi.mocked(fs.readdirSync).mockImplementation(((path: string) => {
        if (path.endsWith("projects")) return [mockDirent("test-project")];
        return [];
      }) as unknown as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(mockProjectContent);

      const technologies = loadTechnologies();

      expect(technologies.size).toBeGreaterThan(0);
      expect(technologies.has("react")).toBe(true);
      expect(technologies.has("typescript")).toBe(true);
      expect(technologies.has("next.js")).toBe(true);
    });

    it("should normalize technology names to lowercase slugs", () => {
      const mockExperiences = [
        {
          company: "Test Co",
          company_url: "https://test.com",
          logo_path: "/logo.png",
          title: "Engineer",
          location: "Remote",
          startDate: "2020-01",
          description: "Desc",
          responsibilities: ["Work"],
          technologies: ["React", "TypeScript", "Next.js"],
        },
      ];

      vi.mocked(experienceMock.getAllExperience).mockReturnValue(
        mockExperiences,
      );
      vi.mocked(fs.readdirSync).mockReturnValue([]);

      const technologies = loadTechnologies();

      // All should be lowercase
      expect(technologies.has("react")).toBe(true);
      expect(technologies.has("typescript")).toBe(true);
      expect(technologies.has("next.js")).toBe(true);

      // Original casing preserved in name
      const react = technologies.get("react");
      expect(react?.name).toBe("React");
    });
  });

  describe("Validation Functions", () => {
    describe("validateBlogPost", () => {
      it("should validate a valid blog post", () => {
        const validPost = {
          slug: "test",
          title: "Test",
          description: "Desc",
          date: "2025-10-19",
          tags: [],
          content: "Content",
          readingTime: "1 min read",
          image: "blog/test-2025-10-19",
          imageAlt: "Image",
          relations: {
            technologies: [],
          },
        };

        const result = validateBlogPost(validPost);

        expect(result.success).toBe(true);
      });

      it("should reject blog post with invalid date", () => {
        const invalidPost = {
          slug: "test",
          title: "Test",
          description: "Desc",
          date: "2025-02-30", // Invalid date
          tags: [],
          content: "Content",
          readingTime: "1 min read",
          image: "blog/test-2025-02-30",
          imageAlt: "Image",
          relations: {
            technologies: [],
          },
        };

        const result = validateBlogPost(invalidPost);

        expect(result.success).toBe(false);
      });
    });

    describe("validateTechnology", () => {
      it("should validate a valid technology", () => {
        const validTech = {
          slug: "react",
          name: "React",
          relations: {
            blogs: [],
            adrs: [],
            projects: [],
            roles: [],
          },
        };

        const result = validateTechnology(validTech);

        expect(result.success).toBe(true);
      });
    });
  });

  describe("Referential Integrity", () => {
    describe("validateReferentialIntegrity", () => {
      it("should pass when all references are valid", () => {
        const technologies = new Map([
          [
            "react",
            {
              slug: "react",
              name: "React",
              relations: { blogs: [], adrs: [], projects: [], roles: [] },
            },
          ],
        ]);

        const blogs = new Map();
        const projects = new Map([
          [
            "test-project",
            {
              slug: "test-project",
              title: "Test",
              description: "Desc",
              date: "2025-01-01",
              status: "live" as const,
              content: "Content",
              relations: {
                technologies: ["react"],
                adrs: [],
              },
            },
          ],
        ]);
        const adrs = new Map();
        const roles = new Map();

        const errors = validateReferentialIntegrity(
          technologies,
          blogs,
          projects,
          adrs,
          roles,
        );

        expect(errors).toEqual([]);
      });

      it("should detect missing technology reference", () => {
        const technologies = new Map();
        const blogs = new Map();
        const projects = new Map([
          [
            "test-project",
            {
              slug: "test-project",
              title: "Test",
              description: "Desc",
              date: "2025-01-01",
              status: "live" as const,
              content: "Content",
              relations: {
                technologies: ["react"], // react doesn't exist
                adrs: [],
              },
            },
          ],
        ]);
        const adrs = new Map();
        const roles = new Map();

        const errors = validateReferentialIntegrity(
          technologies,
          blogs,
          projects,
          adrs,
          roles,
        );

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.type).toBe("missing_reference");
        expect(errors[0]?.value).toBe("react");
      });

      it("should detect missing ADR reference", () => {
        const technologies = new Map();
        const blogs = new Map();
        const projects = new Map([
          [
            "test-project",
            {
              slug: "test-project",
              title: "Test",
              description: "Desc",
              date: "2025-01-01",
              status: "live" as const,
              content: "Content",
              relations: {
                technologies: [],
                adrs: ["001-missing"], // ADR doesn't exist
              },
            },
          ],
        ]);
        const adrs = new Map();
        const roles = new Map();

        const errors = validateReferentialIntegrity(
          technologies,
          blogs,
          projects,
          adrs,
          roles,
        );

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.type).toBe("missing_reference");
        expect(errors[0]?.field).toBe("adrs");
      });

      it("should detect missing project reference in ADR", () => {
        const technologies = new Map();
        const blogs = new Map();
        const projects = new Map();
        const adrs = new Map([
          [
            "001-test",
            {
              slug: "001-test",
              title: "Test ADR",
              date: "2025-01-01",
              status: "Accepted" as const,
              content: "Content",
              readingTime: "1 min",
              relations: {
                project: "missing-project", // Project doesn't exist
                technologies: [],
              },
            },
          ],
        ]);
        const roles = new Map();

        const errors = validateReferentialIntegrity(
          technologies,
          blogs,
          projects,
          adrs,
          roles,
        );

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.type).toBe("missing_reference");
        expect(errors[0]?.field).toBe("project");
      });
    });

    describe("buildTechnologyRelations", () => {
      it("should build bidirectional relations", () => {
        const technologies = new Map([
          [
            "react",
            {
              slug: "react",
              name: "React",
              relations: { blogs: [], adrs: [], projects: [], roles: [] },
            },
          ],
        ]);

        const blogs = new Map();
        const projects = new Map([
          [
            "test-project",
            {
              slug: "test-project",
              title: "Test",
              description: "Desc",
              date: "2025-01-01",
              status: "live" as const,
              content: "Content",
              relations: {
                technologies: ["react"],
                adrs: [],
              },
            },
          ],
        ]);
        const adrs = new Map();
        const roles = new Map();

        buildTechnologyRelations(technologies, blogs, projects, adrs, roles);

        const react = technologies.get("react");
        expect(react?.relations.projects).toEqual(["test-project"]);
      });

      it("should not create duplicate relations", () => {
        const technologies = new Map([
          [
            "react",
            {
              slug: "react",
              name: "React",
              relations: { blogs: [], adrs: [], projects: [], roles: [] },
            },
          ],
        ]);

        const blogs = new Map();
        const projects = new Map([
          [
            "project-1",
            {
              slug: "project-1",
              title: "Project 1",
              description: "Desc",
              date: "2025-01-01",
              status: "live" as const,
              content: "Content",
              relations: {
                technologies: ["react"],
                adrs: [],
              },
            },
          ],
          [
            "project-2",
            {
              slug: "project-2",
              title: "Project 2",
              description: "Desc",
              date: "2025-01-01",
              status: "live" as const,
              content: "Content",
              relations: {
                technologies: ["react"],
                adrs: [],
              },
            },
          ],
        ]);
        const adrs = new Map();
        const roles = new Map();

        buildTechnologyRelations(technologies, blogs, projects, adrs, roles);

        const react = technologies.get("react");
        expect(react?.relations.projects).toEqual(["project-1", "project-2"]);
        expect(react?.relations.projects.length).toBe(2);
      });
    });
  });
});
