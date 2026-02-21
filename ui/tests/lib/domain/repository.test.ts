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

const experienceContentMock = vi.hoisted(() => ({
  experiences: [] as Array<{
    company: string;
    companyUrl: string;
    logoPath: string;
    title: string;
    location: string;
    startDate: string;
    endDate?: string;
    description: string;
    responsibilities: string[];
    technologies: string[];
  }>,
}));

vi.mock("fs", () => fsMock);
vi.mock("path", () => pathMock);
vi.mock("@/content/experience", () => experienceContentMock);

// Import after mocks are hoisted
import * as fs from "node:fs";
import {
  loadADRs,
  loadBlogPosts,
  loadJobRoles,
  loadProjects,
  loadTechnologies,
  validateBlogPost,
  validateReferentialIntegrity,
  validateTechnology,
} from "@/lib/repository";

describe("Domain Repository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  describe("loadBlogPosts", () => {
    it("should return empty map when blog directory does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = loadBlogPosts();

      expect(result.entities.size).toBe(0);
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

      const result = loadBlogPosts();

      expect(result.entities.size).toBe(1);
      const post = result.entities.get("test-post");
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

      const result = loadBlogPosts();

      expect(result.entities.size).toBe(1);
      expect(result.entities.has("post")).toBe(true);
      expect(result.entities.has("README")).toBe(false);
    });
  });

  describe("loadProjects", () => {
    it("should return empty map when projects directory does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = loadProjects();

      expect(result.entities.size).toBe(0);
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

      const result = loadProjects();

      expect(result.entities.size).toBe(1);
      const project = result.entities.get("test-project");
      expect(project).toBeDefined();
      expect(project?.title).toBe("Test Project");
      expect(result.relations.get("test-project")?.technologies).toEqual([
        "react",
        "typescript",
      ]);
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

      const result = loadProjects();

      expect(result.entities.size).toBe(1);
      expect(result.relations.get("test-project")?.adrs).toEqual([
        "test-project:001-test",
      ]);
    });

    it("should reject deprecated inherits_adrs in project frontmatter", () => {
      const mockProjectContent = `---
title: "Test Project"
description: "A test project"
date: "2025-01-01"
status: "live"
inherits_adrs:
  - "personal-site:002-react"
---
Content`;

      vi.mocked(fs.existsSync).mockImplementation(() => true);
      vi.mocked(fs.readdirSync).mockImplementation(((path: string) => {
        if (path.endsWith("projects")) return [mockDirent("test-project")];
        return [];
      }) as unknown as typeof fs.readdirSync);
      vi.mocked(fs.readFileSync).mockReturnValue(mockProjectContent);

      expect(() => loadProjects()).toThrow("deprecated 'inherits_adrs'");
    });
  });

  describe("loadADRs", () => {
    it("should return empty map when projects directory does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = loadADRs();

      expect(result.entities.size).toBe(0);
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

      const result = loadADRs();

      expect(result.entities.size).toBe(1);
      const adr = result.entities.get("project-1:001-react");
      expect(adr).toBeDefined();
      expect(adr?.title).toBe("ADR 001: Use React");
      expect(result.relations.get("project-1:001-react")?.project).toBe(
        "project-1",
      );
      expect(result.relations.get("project-1:001-react")?.technologies).toEqual(
        ["react"],
      );
    });

    it("should derive inherited ADR stub content from source ADR", () => {
      const sourceADR = `---
title: "ADR 002: React"
date: "2025-10-18"
status: "Accepted"
tech_stack: ["React"]
---

Canonical source content.`;
      const inheritedStub = `---
inherits_from: "personal-site:002-react"
---

Recipe-site note: this is adopted as-is for now.
`;

      vi.mocked(fs.existsSync).mockImplementation(() => true);
      vi.mocked(fs.readdirSync).mockImplementation(((path: string) => {
        if (path.endsWith("projects")) {
          return [mockDirent("personal-site"), mockDirent("recipe-site")];
        }
        if (path.includes("personal-site/adrs")) return ["002-react.mdx"];
        if (path.includes("recipe-site/adrs")) return ["000-react.mdx"];
        return [];
      }) as unknown as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr.includes("personal-site/adrs/002-react.mdx")) {
          return sourceADR;
        }
        if (pathStr.includes("recipe-site/adrs/000-react.mdx")) {
          return inheritedStub;
        }
        return "";
      });

      const result = loadADRs();
      const inherited = result.entities.get("recipe-site:000-react");
      expect(inherited).toBeDefined();
      expect(inherited?.inheritsFrom).toBe("personal-site:002-react");
      expect(inherited?.title).toBe("ADR 002: React");
      expect(inherited?.content).toContain("Recipe-site note:");
      expect(
        result.relations.get("recipe-site:000-react")?.technologies,
      ).toEqual(["react"]);
    });
  });

  describe("loadJobRoles", () => {
    it("should load roles from content experiences", () => {
      experienceContentMock.experiences = [
        {
          company: "Microsoft",
          companyUrl: "https://microsoft.com",
          logoPath: "/logos/microsoft.png",
          title: "Software Engineer",
          location: "Seattle, WA",
          startDate: "2020-01",
          endDate: "2022-06",
          description: "Worked on cool stuff",
          responsibilities: ["Built features"],
          technologies: ["C#", "Azure"],
        },
      ];

      const result = loadJobRoles();

      expect(result.entities.size).toBe(1);
      const role = Array.from(result.entities.values())[0];
      expect(role).toBeDefined();
      expect(role?.company).toBe("Microsoft");
      const roleSlug = Array.from(result.entities.keys())[0];
      expect(result.relations.get(roleSlug!)?.technologies).toEqual([
        "csharp",
        "azure",
      ]);
    });
  });

  describe("loadTechnologies", () => {
    it("should build technology catalog from all content", () => {
      experienceContentMock.experiences = [
        {
          company: "Test Co",
          companyUrl: "https://test.com",
          logoPath: "/logo.png",
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

      vi.mocked(fs.readdirSync).mockImplementation(((path: string) => {
        if (path.endsWith("projects")) return [mockDirent("test-project")];
        return [];
      }) as unknown as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(mockProjectContent);

      const technologies = loadTechnologies();

      expect(technologies.size).toBeGreaterThan(0);
      expect(technologies.has("react")).toBe(true);
      expect(technologies.has("typescript")).toBe(true);
      expect(technologies.has("nextdotjs")).toBe(true);
    });

    it("should normalize technology names to lowercase slugs", () => {
      experienceContentMock.experiences = [
        {
          company: "Test Co",
          companyUrl: "https://test.com",
          logoPath: "/logo.png",
          title: "Engineer",
          location: "Remote",
          startDate: "2020-01",
          description: "Desc",
          responsibilities: ["Work"],
          technologies: ["React", "TypeScript", "Next.js"],
        },
      ];

      vi.mocked(fs.readdirSync).mockReturnValue([]);

      const technologies = loadTechnologies();

      // All should be normalized (special chars mapped to words)
      expect(technologies.has("react")).toBe(true);
      expect(technologies.has("typescript")).toBe(true);
      expect(technologies.has("nextdotjs")).toBe(true);

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
          content: "Content",
          readingTime: "1 min read",
          image: "blog/test-2025-10-19",
          imageAlt: "Image",
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
          content: "Content",
          readingTime: "1 min read",
          image: "blog/test-2025-02-30",
          imageAlt: "Image",
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
          website: "https://react.dev",
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
              website: "https://react.dev",
            },
          ],
        ]);

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
            },
          ],
        ]);

        const projectRelations = new Map([
          [
            "test-project",
            {
              technologies: ["react"],
              adrs: [],
              tags: [],
            },
          ],
        ]);

        const errors = validateReferentialIntegrity({
          technologies,
          adrs: new Map(),
          projects,
          blogRelations: new Map(),
          projectRelations,
          adrRelations: new Map(),
          roleRelations: new Map(),
        });

        expect(errors).toEqual([]);
      });

      it("should detect missing technology reference", () => {
        const technologies = new Map();
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
            },
          ],
        ]);

        const projectRelations = new Map([
          [
            "test-project",
            {
              technologies: ["react"], // react doesn't exist
              adrs: [],
              tags: [],
            },
          ],
        ]);

        const errors = validateReferentialIntegrity({
          technologies,
          adrs: new Map(),
          projects,
          blogRelations: new Map(),
          projectRelations,
          adrRelations: new Map(),
          roleRelations: new Map(),
        });

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.type).toBe("missing_reference");
        expect(errors[0]?.value).toBe("react");
      });

      it("should detect missing ADR reference", () => {
        const technologies = new Map();
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
            },
          ],
        ]);

        const projectRelations = new Map([
          [
            "test-project",
            {
              technologies: [],
              adrs: ["001-missing"], // ADR doesn't exist
              tags: [],
            },
          ],
        ]);

        const errors = validateReferentialIntegrity({
          technologies,
          adrs: new Map(),
          projects,
          blogRelations: new Map(),
          projectRelations,
          adrRelations: new Map(),
          roleRelations: new Map(),
        });

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.type).toBe("missing_reference");
        expect(errors[0]?.field).toBe("adrs");
      });

      it("should detect duplicate ADR slugs in project context", () => {
        const technologies = new Map();
        const projects = new Map([
          [
            "recipe-site",
            {
              slug: "recipe-site",
              title: "Recipe Site",
              description: "Desc",
              date: "2025-01-01",
              status: "live" as const,
              content: "Content",
            },
          ],
          [
            "personal-site",
            {
              slug: "personal-site",
              title: "Personal Site",
              description: "Desc",
              date: "2025-01-01",
              status: "live" as const,
              content: "Content",
            },
          ],
        ]);
        const adrs = new Map([
          [
            "recipe-site:001-react",
            {
              adrRef: "recipe-site:001-react",
              slug: "001-react",
              projectSlug: "recipe-site",
              title: "Recipe ADR",
              date: "2025-01-01",
              status: "Accepted" as const,
              content: "Content",
              readingTime: "1 min",
            },
          ],
          [
            "personal-site:001-react",
            {
              adrRef: "personal-site:001-react",
              slug: "001-react",
              projectSlug: "personal-site",
              title: "Personal ADR",
              date: "2025-01-01",
              status: "Accepted" as const,
              content: "Content",
              readingTime: "1 min",
            },
          ],
        ]);

        const projectRelations = new Map([
          [
            "recipe-site",
            {
              technologies: [],
              adrs: ["recipe-site:001-react", "personal-site:001-react"],
              tags: [],
            },
          ],
        ]);

        const errors = validateReferentialIntegrity({
          technologies,
          adrs,
          projects,
          blogRelations: new Map(),
          projectRelations,
          adrRelations: new Map(),
          roleRelations: new Map(),
        });

        expect(
          errors.some(
            (error) =>
              error.type === "invalid_reference" &&
              error.field === "adrs" &&
              error.message.includes("Duplicate ADR slug"),
          ),
        ).toBe(true);
      });

      it("should detect missing project reference in ADR", () => {
        const technologies = new Map();
        const projects = new Map();
        const adrs = new Map([
          [
            "test-project:001-test",
            {
              adrRef: "test-project:001-test",
              slug: "001-test",
              projectSlug: "test-project",
              title: "Test ADR",
              date: "2025-01-01",
              status: "Accepted" as const,
              content: "Content",
              readingTime: "1 min",
            },
          ],
        ]);

        const adrRelations = new Map([
          [
            "test-project:001-test",
            {
              project: "missing-project", // Project doesn't exist
              technologies: [],
            },
          ],
        ]);

        const errors = validateReferentialIntegrity({
          technologies,
          adrs,
          projects,
          blogRelations: new Map(),
          projectRelations: new Map(),
          adrRelations,
          roleRelations: new Map(),
        });

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.type).toBe("missing_reference");
        expect(errors[0]?.field).toBe("project");
      });
    });
  });
});
