import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import readingTime from "reading-time";

/**
 * Base content item that all content types must extend
 */
export interface BaseContent {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated?: string;
  tags: string[];
  content: string;
  readingTime: string;
}

/**
 * Validator function type - validates and extracts frontmatter fields
 */
export type ContentValidator<T extends BaseContent> = (
  data: unknown,
  content: string,
  slug: string,
) => Omit<T, "slug" | "content" | "readingTime">;

/**
 * Configuration for a content type
 */
export interface ContentConfig<T extends BaseContent> {
  /** Content directory relative to process.cwd() (e.g., "content/blog") */
  contentDir: string;
  /** Validator function to parse and validate frontmatter */
  validate: ContentValidator<T>;
}

/**
 * Generic content manager - handles file operations, validation, and parsing
 * for any content type (blog posts, projects, talks, etc.)
 */
export class ContentManager<T extends BaseContent> {
  private contentDirectory: string;
  private validate: ContentValidator<T>;

  constructor(config: ContentConfig<T>) {
    this.contentDirectory = path.join(process.cwd(), config.contentDir);
    this.validate = config.validate;
  }

  /**
   * Get all content slugs (filenames without .mdx extension)
   */
  getAllSlugs(): string[] {
    if (!fs.existsSync(this.contentDirectory)) {
      return [];
    }
    const files = fs.readdirSync(this.contentDirectory);
    return files
      .filter((file) => file.endsWith(".mdx") && !file.startsWith("."))
      .map((file) => file.replace(/\.mdx$/, ""));
  }

  /**
   * Validate slug format and security
   */
  private validateSlug(slug: string): void {
    // Validate slug: only lowercase letters, numbers, hyphens, and underscores
    if (!slug || !/^[a-z0-9_-]+$/.test(slug)) {
      throw new Error("Invalid slug");
    }
  }

  /**
   * Validate file path is within content directory (security check)
   */
  private validatePath(fullPath: string): void {
    const normalizedPath = path.resolve(fullPath);
    const normalizedDir = path.resolve(this.contentDirectory);
    const relativePath = path.relative(normalizedDir, normalizedPath);

    // Security checks:
    // 1. relativePath must not start with '..' (going outside the directory)
    // 2. relativePath must not be an absolute path (completely outside)
    // 3. Must have .mdx extension
    if (
      relativePath.startsWith("..") ||
      path.isAbsolute(relativePath) ||
      !relativePath.endsWith(".mdx")
    ) {
      throw new Error("Invalid slug");
    }
  }

  /**
   * Get a single content item by slug
   */
  getBySlug(slug: string): T {
    this.validateSlug(slug);

    const fullPath = path.join(this.contentDirectory, `${slug}.mdx`);
    this.validatePath(fullPath);

    const fileContents = fs.readFileSync(fullPath, "utf8");
    const { data, content } = matter(fileContents);

    // Use the provided validator to parse and validate frontmatter
    const validated = this.validate(data, content, slug);

    const stats = readingTime(content);

    return {
      slug,
      content,
      readingTime: stats.text,
      ...validated,
    } as T;
  }

  /**
   * Get all content items, sorted by date (newest first)
   */
  getAll(): T[] {
    const slugs = this.getAllSlugs();
    const items = slugs.map((slug) => this.getBySlug(slug));

    return items.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA; // Descending order (newest first)
    });
  }
}

/**
 * Common validation helpers
 */
export const validators = {
  /**
   * Validate required string field
   */
  requireString(data: unknown, field: string, slug: string): string {
    if (
      typeof data !== "object" ||
      data === null ||
      !(field in data) ||
      typeof (data as Record<string, unknown>)[field] !== "string"
    ) {
      throw new Error(`Content ${slug} is missing required field: ${field}`);
    }
    const record = data as Record<string, string>;
    return record[field]!;
  },

  /**
   * Validate required date field
   */
  requireDate(data: unknown, field: string, slug: string): string {
    const value = validators.requireString(data, field, slug);
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) {
      throw new Error(
        `Content ${slug} has invalid date in field ${field}: ${value}`,
      );
    }
    return value;
  },

  /**
   * Validate required array field
   */
  requireArray(data: unknown, field: string, slug: string): string[] {
    if (
      typeof data !== "object" ||
      data === null ||
      !(field in data) ||
      !Array.isArray((data as Record<string, unknown>)[field])
    ) {
      throw new Error(
        `Content ${slug} is missing required field: ${field} (must be an array)`,
      );
    }
    const record = data as Record<string, string[]>;
    return record[field]!;
  },

  /**
   * Validate optional string field
   */
  optionalString(
    data: unknown,
    field: string,
    slug: string,
  ): string | undefined {
    if (
      typeof data !== "object" ||
      data === null ||
      !(field in data) ||
      (data as Record<string, unknown>)[field] === undefined
    ) {
      return undefined;
    }
    if (typeof (data as Record<string, unknown>)[field] !== "string") {
      throw new Error(
        `Content ${slug} has invalid ${field} field: must be a string`,
      );
    }
    const record = data as Record<string, string>;
    return record[field]!;
  },

  /**
   * Validate optional date field
   */
  optionalDate(data: unknown, field: string, slug: string): string | undefined {
    const value = validators.optionalString(data, field, slug);
    if (value === undefined) return undefined;
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) {
      throw new Error(
        `Content ${slug} has invalid date in field ${field}: ${value}`,
      );
    }
    return value;
  },

  /**
   * Validate optional array field
   */
  optionalArray(
    data: unknown,
    field: string,
    slug: string,
  ): string[] | undefined {
    if (
      typeof data !== "object" ||
      data === null ||
      !(field in data) ||
      (data as Record<string, unknown>)[field] === undefined
    ) {
      return undefined;
    }
    if (!Array.isArray((data as Record<string, unknown>)[field])) {
      throw new Error(
        `Content ${slug} has invalid ${field} field: must be an array`,
      );
    }
    const record = data as Record<string, string[]>;
    return record[field]!;
  },

  /**
   * Validate optional URL field
   */
  optionalUrl(data: unknown, field: string, slug: string): string | undefined {
    const value = validators.optionalString(data, field, slug);
    if (value === undefined) return undefined;
    try {
      new URL(value);
      return value;
    } catch {
      throw new Error(
        `Content ${slug} has invalid URL in field ${field}: ${value}`,
      );
    }
  },
};
