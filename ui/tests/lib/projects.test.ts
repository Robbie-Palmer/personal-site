import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoist mocks
const fsMock = vi.hoisted(() => {
  const existsSync = vi.fn();
  const readdirSync = vi.fn();
  const readFileSync = vi.fn();
  const statSync = vi.fn();

  return {
    default: { existsSync, readdirSync, readFileSync, statSync },
    existsSync,
    readdirSync,
    readFileSync,
    statSync,
  };
});

const pathMock = vi.hoisted(() => {
  const join = vi.fn((...args: string[]) => args.join("/"));
  return {
    default: { join },
    join,
  };
});

vi.mock("node:fs", () => fsMock);
vi.mock("node:path", () => pathMock);

import * as fs from "node:fs";
import { getAllProjects, getProject, getProjectADR } from "@/lib/projects";

describe("Projects functions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default mocks
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
    vi.mocked(fs.readdirSync).mockReturnValue([] as any);
  });

  describe("getProject", () => {
    it("should parse frontmatter correctly", () => {
      const mockContent = `---
title: "Test Project"
description: "A test project"
date: "2025-01-01"
tech_stack: ["Next.js", "React"]
repo_url: "https://github.com/test/test"
demo_url: "https://test.com"
---

# Overview

Content here.`;

      vi.mocked(fs.readFileSync).mockReturnValue(mockContent);

      const project = getProject("test-project");

      expect(project).toEqual({
        slug: "test-project",
        title: "Test Project",
        description: "A test project",
        date: "2025-01-01",
        updated: undefined,
        tech_stack: ["Next.js", "React"],
        repo_url: "https://github.com/test/test",
        demo_url: "https://test.com",
        content: "\n# Overview\n\nContent here.",
        adrs: [],
      });
    });

    it("should throw if required fields are missing", () => {
      const mockContent = `---
title: "Missing Date"
description: "Oops"
tech_stack: ["React"]
---`;
      vi.mocked(fs.readFileSync).mockReturnValue(mockContent);

      expect(() => getProject("bad-project")).toThrow(/invalid frontmatter/);
    });

    it("should throw if tech_stack is empty", () => {
      const mockContent = `---
title: "Empty Tech Stack"
description: "Oops"
date: "2025-01-01"
tech_stack: []
---`;
      vi.mocked(fs.readFileSync).mockReturnValue(mockContent);

      expect(() => getProject("bad-project")).toThrow(/invalid frontmatter/);
    });

    it("should throw if date is invalid", () => {
      const mockContent = `---
title: "Invalid Date"
description: "Oops"
date: "not-a-date"
tech_stack: ["React"]
---`;
      vi.mocked(fs.readFileSync).mockReturnValue(mockContent);

      expect(() => getProject("bad-project")).toThrow(/invalid frontmatter/);
    });
    it("should aggregate tech stack from Accepted ADRs", () => {
      const projectSlug = "test-project";

      vi.mocked(fs.existsSync).mockReturnValue(true);

      vi.mocked(fs.readdirSync).mockImplementation((path) => {
        if (path.toString().endsWith(pathMock.join(projectSlug, "adrs"))) {
          return [
            "001-accepted.mdx",
            "002-rejected.mdx",
            "003-proposed.mdx",
            "004-deprecated.mdx",
            "005-accepted-no-stack.mdx",
          ] as any;
        }
        return [] as any;
      });

      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr.endsWith(`${projectSlug}/index.mdx`)) {
          return `---
title: "Test Project"
description: "A test project"
date: "2025-01-01"
tech_stack: ["Next.js", "React"]
---`;
        }
        if (pathStr.endsWith("001-accepted.mdx")) {
          return `---
title: "Accepted ADR"
date: "2025-01-01"
status: "Accepted"
tech_stack: ["TypeScript", "Next.js"]
---`;
        }
        if (pathStr.endsWith("002-rejected.mdx")) {
          return `---
title: "Rejected ADR"
date: "2025-01-01"
status: "Rejected"
tech_stack: ["Rust"]
---`;
        }
        if (pathStr.endsWith("003-proposed.mdx")) {
          return `---
title: "Proposed ADR"
date: "2025-01-01"
status: "Proposed"
tech_stack: ["Go"]
---`;
        }
        if (pathStr.endsWith("004-deprecated.mdx")) {
          return `---
title: "Deprecated ADR"
date: "2025-01-01"
status: "Deprecated"
tech_stack: ["jQuery"]
---`;
        }
        if (pathStr.endsWith("005-accepted-no-stack.mdx")) {
          return `---
title: "Accepted No Stack"
date: "2025-01-01"
status: "Accepted"
---`;
        }
        return "";
      });

      const project = getProject(projectSlug);

      // Should include:
      // - Next.js (from project & ADR 001 - deduped)
      // - React (from project)
      // - TypeScript (from ADR 001)
      // Should NOT include:
      // - Rust, Go, jQuery (from non-accepted ADRs)
      expect(project.tech_stack).toEqual(["Next.js", "React", "TypeScript"]);
    });
  });

  describe("getAllProjects (Sorting)", () => {
    it("should sort projects by date descending (newest first)", () => {
      vi.mocked(fs.readdirSync).mockImplementation((path) => {
        if (path.toString().endsWith("adrs")) return [];
        return ["old", "new", "middle"] as any;
      });

      const projectsData: Record<string, string> = {
        old: `---
title: "Old"
description: "Old"
date: "2024-01-01"
tech_stack: ["React"]
---`,
        new: `---
title: "New"
description: "New"
date: "2025-01-01"
tech_stack: ["React"]
---`,
        middle: `---
title: "Middle"
description: "Middle"
date: "2024-06-01"
tech_stack: ["React"]
---`,
      };

      vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
        const slug = path.split("/").slice(-2, -1)[0]; // naive parsing based on mock join path
        if (projectsData[slug]) return projectsData[slug];
        return "";
      });

      const projects = getAllProjects();

      expect(projects.map((p) => p.slug)).toEqual(["new", "middle", "old"]);
    });
  });

  describe("getProjectADR", () => {
    it("should find and parse an ADR", () => {
      const adrContent = `---
title: "Monorepo"
date: "2025-11-01"
status: "Accepted"
---
Decided to use monorepo.`;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(adrContent);

      const adr = getProjectADR("test-project", "001-monorepo");

      expect(adr).toEqual({
        slug: "001-monorepo",
        title: "Monorepo",
        date: "2025-11-01",
        status: "Accepted",
        content: "Decided to use monorepo.",
        readingTime: "1 min read",
      });
    });

    it("should throw if ADR not found", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(() => getProjectADR("test", "missing")).toThrow(/ADR not found/);
    });
  });
});
