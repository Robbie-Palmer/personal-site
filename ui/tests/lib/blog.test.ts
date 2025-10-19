import * as fs from "node:fs";
import * as path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAllPostSlugs, getAllPosts, getPostBySlug } from "@/lib/blog";

// Mock the filesystem modules
vi.mock("node:fs");
vi.mock("node:path");

describe("Blog functions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Setup default path.join behavior
    vi.mocked(path.join).mockImplementation((...args) => args.join("/"));
    vi.mocked(path.resolve).mockImplementation((...args) => {
      const joined = args.join("/");
      return joined.startsWith("/") ? joined : `/${joined}`;
    });
  });

  describe("getAllPostSlugs", () => {
    it("should return empty array when directory does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = getAllPostSlugs();
      expect(result).toEqual([]);
    });

    it("should return slugs from .mdx files only", () => {
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
      expect(result).toEqual(["post-one", "post-two", ".hidden"]);
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

    it("should accept valid simple slugs", () => {
      vi.mocked(path.resolve)
        .mockReturnValueOnce("/mock/content/blog/valid-slug.mdx")
        .mockReturnValueOnce("/mock/content/blog");
      vi.mocked(fs.readFileSync).mockReturnValue(validFileContent);
      const result = getPostBySlug("valid-slug");
      expect(result.slug).toBe("valid-slug");
      expect(result.title).toBe("Test Post");
    });

    it("should accept slugs with hyphens and underscores", () => {
      vi.mocked(path.resolve)
        .mockReturnValueOnce("/mock/content/blog/valid-slug_123.mdx")
        .mockReturnValueOnce("/mock/content/blog");
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
      vi.mocked(fs.readFileSync).mockReturnValue(mockContent);
      const result = getPostBySlug("test");
      expect(result).toEqual({
        slug: "test",
        title: "My Blog Post",
        description: "A great post",
        date: "2025-10-19",
        tags: ["tag1", "tag2"],
        content: "\n# Heading\n\nThis is the content.",
      });
    });

    it("should use default values for missing frontmatter fields", () => {
      const mockContent = `---
title: "Only Title"
---

Content here.`;
      vi.mocked(path.resolve)
        .mockReturnValueOnce("/mock/content/blog/test.mdx")
        .mockReturnValueOnce("/mock/content/blog");
      vi.mocked(fs.readFileSync).mockReturnValue(mockContent);
      const result = getPostBySlug("test");
      expect(result).toEqual({
        slug: "test",
        title: "Only Title",
        description: "",
        date: "",
        tags: [],
        content: "\nContent here.",
      });
    });

    it("should use 'Untitled' when title is missing", () => {
      const mockContent = `---
description: "No title here"
---

Content.`;
      vi.mocked(path.resolve)
        .mockReturnValueOnce("/mock/content/blog/test.mdx")
        .mockReturnValueOnce("/mock/content/blog");
      vi.mocked(fs.readFileSync).mockReturnValue(mockContent);
      const result = getPostBySlug("test");
      expect(result.title).toBe("Untitled");
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
      let callCount = 0;
      vi.mocked(path.resolve).mockImplementation(() => {
        callCount++;
        // Always return valid paths that pass security checks
        if (callCount % 2 === 1) {
          return "/mock/content/blog/post.mdx";
        }
        return "/mock/content/blog";
      });
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
    });

    it("should not crash when sorting posts with invalid dates", () => {
      // If frontmatter has date: "oops-not-a-date", new Date() returns NaN
      // This test ensures sorting doesn't throw when comparing NaN timestamps
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        "valid.mdx",
        "invalid.mdx",
        // biome-ignore lint/suspicious/noExplicitAny: Vitest fs mock typing
      ] as any);
      let callCount = 0;
      vi.mocked(path.resolve).mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 1) {
          return "/mock/content/blog/post.mdx";
        }
        return "/mock/content/blog";
      });
      // biome-ignore lint/suspicious/noExplicitAny: Vitest fs mock typing
      vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
        if (filePath.includes("valid")) {
          return `---
title: "Valid"
date: "2025-10-19"
---
Content`;
        }
        return `---
title: "Invalid"
date: "oops-not-a-date"
---
Content`;
      });
      const result = getAllPosts();
      expect(result).toHaveLength(2);
      // Valid date should sort first (NaN - validTimestamp = NaN, which makes it sort last)
      expect(result[0]?.slug).toBe("valid");
      expect(result[1]?.slug).toBe("invalid");
    });

    it("should handle posts with same date consistently", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        "first.mdx",
        "second.mdx",
        "third.mdx",
        // biome-ignore lint/suspicious/noExplicitAny: Vitest fs mock typing
      ] as any);
      let callCount = 0;
      vi.mocked(path.resolve).mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 1) {
          return "/mock/content/blog/post.mdx";
        }
        return "/mock/content/blog";
      });
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
date: "2025-10-19"
---
Content`;
      });
      const result = getAllPosts();
      // Should maintain file system order when dates are equal
      expect(result.map((p) => p.slug)).toEqual(["first", "second", "third"]);
    });
  });
});
