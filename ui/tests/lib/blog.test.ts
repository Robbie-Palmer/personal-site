import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoist mocks before importing code under test to avoid real FS access
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
  const resolve = vi.fn((...args: string[]) => {
    const joined = args.join("/");
    return joined.startsWith("/") ? joined : `/${joined}`;
  });
  const relative = vi.fn((from: string, to: string) => {
    // Simple mock implementation for testing
    if (to.startsWith(from)) {
      return to.slice(from.length + 1); // Remove the base path
    }
    return `../${to.split("/").pop()}`; // Mock going outside
  });
  const isAbsolute = vi.fn((p: string) => p.startsWith("/"));

  return {
    default: { join, resolve, relative, isAbsolute },
    join,
    resolve,
    relative,
    isAbsolute,
  };
});

vi.mock("node:fs", () => fsMock);
vi.mock("node:path", () => pathMock);

// Import after mocks are hoisted
import * as fs from "node:fs";
import * as path from "node:path";
import { getAllPostSlugs, getAllPosts, getPostBySlug } from "@/lib/blog";

describe("Blog functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllPostSlugs", () => {
    it("should return empty array when directory does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = getAllPostSlugs();
      expect(result).toEqual([]);
    });

    it("should return slugs from .mdx files only, excluding hidden files", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        "post-one.mdx",
        "post-two.mdx",
        "README.md",
        "draft.txt",
        ".hidden.mdx",
        // biome-ignore lint/suspicious/noExplicitAny: Vitest fs mock typing
      ] as any);
      const result = getAllPostSlugs();
      expect(result).toEqual(["post-one", "post-two"]);
    });
  });

  describe("getPostBySlug - Security", () => {
    const validFileContent = `---
title: "Test Post"
description: "Test description"
date: "2025-10-19"
tags: ["test"]
---

# Test Content`;

    it("should reject slugs with forward slashes (path traversal attempt)", () => {
      expect(() => getPostBySlug("../etc/passwd")).toThrow("Invalid slug");
      expect(() => getPostBySlug("foo/bar")).toThrow("Invalid slug");
    });

    it("should reject slugs with parent directory references", () => {
      expect(() => getPostBySlug("..")).toThrow("Invalid slug");
      expect(() => getPostBySlug("valid..invalid")).toThrow("Invalid slug");
    });

    it("should reject empty string slug", () => {
      expect(() => getPostBySlug("")).toThrow("Invalid slug");
    });

    it("should reject slugs with whitespace", () => {
      expect(() => getPostBySlug(" valid-slug")).toThrow("Invalid slug");
      expect(() => getPostBySlug("valid-slug ")).toThrow("Invalid slug");
      expect(() => getPostBySlug("valid slug")).toThrow("Invalid slug");
    });

    it("should reject slugs with null bytes", () => {
      expect(() => getPostBySlug("valid\0post")).toThrow("Invalid slug");
      expect(() => getPostBySlug("valid-post\0../../etc/passwd")).toThrow(
        "Invalid slug",
      );
    });

    it("should reject slugs with special characters", () => {
      expect(() => getPostBySlug("valid*post")).toThrow("Invalid slug");
      expect(() => getPostBySlug("valid?post")).toThrow("Invalid slug");
      expect(() => getPostBySlug("valid<post>")).toThrow("Invalid slug");
      expect(() => getPostBySlug("valid|post")).toThrow("Invalid slug");
      expect(() => getPostBySlug("valid:post")).toThrow("Invalid slug");
      expect(() => getPostBySlug('valid"post')).toThrow("Invalid slug");
    });

    it("should reject slugs with uppercase letters", () => {
      expect(() => getPostBySlug("Valid-Post")).toThrow("Invalid slug");
      expect(() => getPostBySlug("ALLCAPS")).toThrow("Invalid slug");
    });

    it("should reject slug that resolves outside content directory", () => {
      // Mock path.resolve to simulate a slug that resolves outside the content dir
      vi.mocked(path.resolve)
        .mockReturnValueOnce("/outside/content/blog/malicious.mdx") // fullPath resolution
        .mockReturnValueOnce("/mock/content/blog"); // contentDirectory resolution
      expect(() => getPostBySlug("malicious")).toThrow("Invalid slug");
    });

    it("should reject slug with path that starts with content dir but is outside (prefix bypass)", () => {
      // This tests the vulnerability: /mock/content/blog-evil/ starts with /mock/content/blog
      // but is actually outside the intended directory
      vi.mocked(path.resolve)
        .mockReturnValueOnce("/mock/content/blog-evil/malicious.mdx") // fullPath - note the "-evil" suffix
        .mockReturnValueOnce("/mock/content/blog"); // contentDirectory
      vi.mocked(path.relative).mockReturnValueOnce(
        "../blog-evil/malicious.mdx",
      ); // relative path shows it goes outside
      expect(() => getPostBySlug("malicious")).toThrow("Invalid slug");
    });

    it("should accept valid simple slugs", () => {
      vi.mocked(path.resolve)
        .mockReturnValueOnce("/mock/content/blog/valid-slug.mdx")
        .mockReturnValueOnce("/mock/content/blog");
      vi.mocked(path.relative).mockReturnValueOnce("valid-slug.mdx");
      vi.mocked(fs.readFileSync).mockReturnValue(validFileContent);
      const result = getPostBySlug("valid-slug");
      expect(result.slug).toBe("valid-slug");
      expect(result.title).toBe("Test Post");
    });

    it("should accept slugs with hyphens and underscores", () => {
      vi.mocked(path.resolve)
        .mockReturnValueOnce("/mock/content/blog/valid-slug_123.mdx")
        .mockReturnValueOnce("/mock/content/blog");
      vi.mocked(path.relative).mockReturnValueOnce("valid-slug_123.mdx");
      vi.mocked(fs.readFileSync).mockReturnValue(validFileContent);
      const result = getPostBySlug("valid-slug_123");
      expect(result.slug).toBe("valid-slug_123");
    });
  });

  describe("getPostBySlug - Content Parsing", () => {
    it("should parse frontmatter and content correctly", () => {
      const mockContent = `---
title: "My Blog Post"
description: "A great post"
date: "2025-10-19"
tags: ["tag1", "tag2"]
---

# Heading

This is the content.`;
      vi.mocked(path.resolve)
        .mockReturnValueOnce("/mock/content/blog/test.mdx")
        .mockReturnValueOnce("/mock/content/blog");
      vi.mocked(path.relative).mockReturnValueOnce("test.mdx");
      vi.mocked(fs.readFileSync).mockReturnValue(mockContent);
      const result = getPostBySlug("test");
      expect(result).toEqual({
        slug: "test",
        title: "My Blog Post",
        description: "A great post",
        date: "2025-10-19",
        tags: ["tag1", "tag2"],
        content: "\n# Heading\n\nThis is the content.",
        readingTime: "1 min read",
      });
    });

    it("should throw error when title is missing", () => {
      const mockContent = `---
description: "No title here"
date: "2025-10-19"
tags: []
---

Content.`;
      vi.mocked(path.resolve)
        .mockReturnValueOnce("/mock/content/blog/test.mdx")
        .mockReturnValueOnce("/mock/content/blog");
      vi.mocked(path.relative).mockReturnValueOnce("test.mdx");
      vi.mocked(fs.readFileSync).mockReturnValue(mockContent);
      expect(() => getPostBySlug("test")).toThrow(
        "missing required field: title",
      );
    });

    it("should throw error when description is missing", () => {
      const mockContent = `---
title: "Test Post"
date: "2025-10-19"
tags: []
---

Content.`;
      vi.mocked(path.resolve)
        .mockReturnValueOnce("/mock/content/blog/test.mdx")
        .mockReturnValueOnce("/mock/content/blog");
      vi.mocked(path.relative).mockReturnValueOnce("test.mdx");
      vi.mocked(fs.readFileSync).mockReturnValue(mockContent);
      expect(() => getPostBySlug("test")).toThrow(
        "missing required field: description",
      );
    });

    it("should throw error when date is missing", () => {
      const mockContent = `---
title: "Test Post"
description: "A test"
tags: []
---

Content.`;
      vi.mocked(path.resolve)
        .mockReturnValueOnce("/mock/content/blog/test.mdx")
        .mockReturnValueOnce("/mock/content/blog");
      vi.mocked(path.relative).mockReturnValueOnce("test.mdx");
      vi.mocked(fs.readFileSync).mockReturnValue(mockContent);
      expect(() => getPostBySlug("test")).toThrow(
        "missing required field: date",
      );
    });

    it("should throw error when date is invalid", () => {
      const mockContent = `---
title: "Test Post"
description: "A test"
date: "not-a-real-date"
tags: []
---

Content.`;
      vi.mocked(path.resolve)
        .mockReturnValueOnce("/mock/content/blog/test.mdx")
        .mockReturnValueOnce("/mock/content/blog");
      vi.mocked(path.relative).mockReturnValueOnce("test.mdx");
      vi.mocked(fs.readFileSync).mockReturnValue(mockContent);
      expect(() => getPostBySlug("test")).toThrow(
        "has invalid date: not-a-real-date",
      );
    });

    it("should throw error when tags is not an array", () => {
      const mockContent = `---
title: "Test Post"
description: "A test"
date: "2025-10-19"
tags: "not-an-array"
---

Content.`;
      vi.mocked(path.resolve)
        .mockReturnValueOnce("/mock/content/blog/test.mdx")
        .mockReturnValueOnce("/mock/content/blog");
      vi.mocked(path.relative).mockReturnValueOnce("test.mdx");
      vi.mocked(fs.readFileSync).mockReturnValue(mockContent);
      expect(() => getPostBySlug("test")).toThrow(
        "missing required field: tags (must be an array)",
      );
    });
  });

  describe("getAllPosts", () => {
    it("should return empty array when no posts exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = getAllPosts();
      expect(result).toEqual([]);
    });

    it("should return posts sorted by date (newest first)", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        "old-post.mdx",
        "new-post.mdx",
        "middle-post.mdx",
        // biome-ignore lint/suspicious/noExplicitAny: Vitest fs mock typing
      ] as any);
      const posts = [
        { slug: "old-post", date: "2025-01-15" },
        { slug: "new-post", date: "2025-10-19" },
        { slug: "middle-post", date: "2025-06-10" },
      ];

      vi.mocked(path.resolve).mockImplementation((...args: string[]) => {
        const joined = args.join("/");
        if (joined.includes(".mdx")) {
          return `/mock/${joined}`;
        }
        return "/mock/content/blog";
      });

      vi.mocked(path.relative).mockImplementation(
        (_from: string, to: string) => {
          // Extract the filename from the full path
          const filename = to.split("/").pop() || "";
          return filename;
        },
      );

      // biome-ignore lint/suspicious/noExplicitAny: Vitest fs mock typing
      vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
        const post = posts.find((p) => filePath.includes(p.slug));
        return `---
title: "${post?.slug}"
description: "Description"
date: "${post?.date}"
tags: []
---
Content`;
      });
      const result = getAllPosts();
      expect(result.map((p) => p.slug)).toEqual([
        "new-post",
        "middle-post",
        "old-post",
      ]);

      // Verify content is included (for search functionality)
      for (const post of result) {
        expect(post).toHaveProperty("content");
        expect(typeof post.content).toBe("string");
      }
    });

    it("should handle posts with same date consistently", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        "first.mdx",
        "second.mdx",
        "third.mdx",
        // biome-ignore lint/suspicious/noExplicitAny: Vitest fs mock typing
      ] as any);

      vi.mocked(path.resolve).mockImplementation((...args: string[]) => {
        const joined = args.join("/");
        if (joined.includes(".mdx")) {
          return `/mock/${joined}`;
        }
        return "/mock/content/blog";
      });

      vi.mocked(path.relative).mockImplementation(
        (_from: string, to: string) => {
          // Extract the filename from the full path
          const filename = to.split("/").pop() || "";
          return filename;
        },
      );

      // All posts have the same date
      // biome-ignore lint/suspicious/noExplicitAny: Vitest fs mock typing
      vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
        const slug = filePath.includes("first")
          ? "first"
          : filePath.includes("second")
            ? "second"
            : "third";
        return `---
title: "${slug}"
description: "Description"
date: "2025-10-19"
tags: []
---
Content`;
      });
      const result = getAllPosts();
      // Should maintain file system order when dates are equal
      expect(result.map((p) => p.slug)).toEqual(["first", "second", "third"]);
    });
  });
});

// Integration test: validate all real posts have valid frontmatter
// This test uses the real filesystem to ensure all blog posts are valid
describe("Blog content validation (integration)", () => {
  beforeEach(() => {
    // Clear mocks to use real fs/path for this test
    vi.clearAllMocks();
  });

  it("all posts in content/blog should have valid frontmatter", async () => {
    // Import the actual unmocked modules
    const realFs = await vi.importActual<typeof import("node:fs")>("node:fs");
    const realPath =
      await vi.importActual<typeof import("node:path")>("node:path");

    const contentDir = realPath.join(process.cwd(), "content/blog");
    const files = realFs
      .readdirSync(contentDir)
      .filter((file) => file.endsWith(".mdx") && !file.startsWith("."));

    // Ensure we actually have posts to test
    expect(files.length).toBeGreaterThan(0);

    // Validate each post by reading and parsing manually
    for (const file of files) {
      const filePath = realPath.join(contentDir, file);
      const content = realFs.readFileSync(filePath, "utf8");
      const slug = file.replace(/\.mdx$/, "");

      // Parse frontmatter using gray-matter
      const matter = await import("gray-matter");
      const { data } = matter.default(content);

      // Validate required fields exist
      expect(data.title, `${slug}: title is required`).toBeTruthy();
      expect(typeof data.title, `${slug}: title must be a string`).toBe(
        "string",
      );

      expect(data.description, `${slug}: description is required`).toBeTruthy();
      expect(
        typeof data.description,
        `${slug}: description must be a string`,
      ).toBe("string");

      expect(data.date, `${slug}: date is required`).toBeTruthy();
      expect(typeof data.date, `${slug}: date must be a string`).toBe("string");

      // Validate date is actually a valid date
      const timestamp = new Date(data.date).getTime();
      expect(
        Number.isNaN(timestamp),
        `${slug}: date "${data.date}" is not a valid date`,
      ).toBe(false);

      expect(Array.isArray(data.tags), `${slug}: tags must be an array`).toBe(
        true,
      );
    }
  });
});
