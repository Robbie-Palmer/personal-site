import { describe, expect, it } from "vitest";
import { getAllPostSlugs, getAllPosts, getPostBySlug } from "@/lib/blog";

/**
 * Blog tests - Integration tests for domain-backed blog functions
 *
 * These tests verify that the blog functions correctly use the domain repository.
 * The domain repository handles all validation, security, and file loading.
 * See tests/lib/domain/repository.test.ts for detailed validation tests.
 */
describe("Blog functions", () => {
  describe("getAllPostSlugs", () => {
    it("should return array of blog post slugs", () => {
      const slugs = getAllPostSlugs();
      expect(Array.isArray(slugs)).toBe(true);
      // Verify slugs are valid (lowercase, alphanumeric, hyphens, underscores)
      for (const slug of slugs) {
        expect(slug).toMatch(/^[a-z0-9_-]+$/);
      }
    });

    it("should return at least one blog post", () => {
      const slugs = getAllPostSlugs();
      expect(slugs.length).toBeGreaterThan(0);
    });
  });

  describe("getPostBySlug", () => {
    it("should return blog post with all required fields", () => {
      const slugs = getAllPostSlugs();
      expect(slugs.length).toBeGreaterThan(0);

      const post = getPostBySlug(slugs[0] ?? "");

      // Verify all required fields exist
      expect(post.slug).toBe(slugs[0]);
      expect(typeof post.title).toBe("string");
      expect(post.title.length).toBeGreaterThan(0);
      expect(typeof post.description).toBe("string");
      expect(post.description.length).toBeGreaterThan(0);
      expect(typeof post.date).toBe("string");
      expect(post.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Array.isArray(post.tags)).toBe(true);
      expect(typeof post.content).toBe("string");
      expect(typeof post.readingTime).toBe("string");
      expect(typeof post.image).toBe("string");
      expect(post.image).toMatch(/^blog\/[a-z0-9_-]+-\d{4}-\d{2}-\d{2}$/);
      expect(typeof post.imageAlt).toBe("string");
    });

    it("should throw error for non-existent post", () => {
      expect(() => getPostBySlug("non-existent-post-12345")).toThrow(
        "Blog post not found",
      );
    });

    it("should return post with technologies field", () => {
      const slugs = getAllPostSlugs();
      const post = getPostBySlug(slugs[0] ?? "");

      expect(post.technologies).toBeDefined();
      expect(Array.isArray(post.technologies)).toBe(true);
    });
  });

  describe("getAllPosts", () => {
    it("should return array of all blog posts", () => {
      const posts = getAllPosts();
      expect(Array.isArray(posts)).toBe(true);
      expect(posts.length).toBeGreaterThan(0);
    });

    it("should return posts sorted by date (newest first)", () => {
      const posts = getAllPosts();
      if (posts.length < 2) {
        // Not enough posts to test sorting
        return;
      }

      for (let i = 0; i < posts.length - 1; i++) {
        const currentDate = new Date(posts[i]?.date ?? "").getTime();
        const nextDate = new Date(posts[i + 1]?.date ?? "").getTime();
        expect(currentDate).toBeGreaterThanOrEqual(nextDate);
      }
    });

    it("should return all posts from getAllPostSlugs", () => {
      const slugs = getAllPostSlugs();
      const posts = getAllPosts();

      expect(posts.length).toBe(slugs.length);

      const postSlugs = posts.map((p) => p.slug);
      for (const slug of slugs) {
        expect(postSlugs).toContain(slug);
      }
    });
  });
});
