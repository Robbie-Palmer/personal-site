import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import readingTime from "reading-time";

const contentDirectory = path.join(process.cwd(), "content/projects");

export interface Project {
  title: string;
  description: string;
  date: string;
  updated?: string;
  tags: string[];
  technologies?: string[];
  company?: string;
  role?: string;
  githubUrl?: string;
  demoUrl?: string;
  experienceLink?: string;
  slug: string;
  content: string;
  readingTime: string;
}

export function getAllProjectSlugs(): string[] {
  if (!fs.existsSync(contentDirectory)) {
    return [];
  }
  const files = fs.readdirSync(contentDirectory);
  return files
    .filter((file) => file.endsWith(".mdx") && !file.startsWith("."))
    .map((file) => file.replace(/\.mdx$/, ""));
}

export function getProjectBySlug(slug: string): Project {
  // Validate slug: only lowercase letters, numbers, hyphens, and underscores
  if (!slug || !/^[a-z0-9_-]+$/.test(slug)) {
    throw new Error("Invalid slug");
  }

  const fullPath = path.join(contentDirectory, `${slug}.mdx`);

  // Ensure the resolved path is within contentDirectory using path.relative
  const normalizedPath = path.resolve(fullPath);
  const normalizedDir = path.resolve(contentDirectory);
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

  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);

  // Validate required frontmatter fields
  if (!data.title || typeof data.title !== "string") {
    throw new Error(`Project ${slug} is missing required field: title`);
  }

  if (!data.description || typeof data.description !== "string") {
    throw new Error(`Project ${slug} is missing required field: description`);
  }

  if (!data.date || typeof data.date !== "string") {
    throw new Error(`Project ${slug} is missing required field: date`);
  }

  // Validate date is actually a valid date
  const dateTimestamp = new Date(data.date).getTime();
  if (Number.isNaN(dateTimestamp)) {
    throw new Error(`Project ${slug} has invalid date: ${data.date}`);
  }

  if (!Array.isArray(data.tags)) {
    throw new Error(
      `Project ${slug} is missing required field: tags (must be an array)`,
    );
  }

  // Validate optional fields if present
  if (data.updated !== undefined) {
    if (typeof data.updated !== "string") {
      throw new Error(
        `Project ${slug} has invalid updated field: must be a string`,
      );
    }
    const updatedTimestamp = new Date(data.updated).getTime();
    if (Number.isNaN(updatedTimestamp)) {
      throw new Error(
        `Project ${slug} has invalid updated date: ${data.updated}`,
      );
    }
  }

  if (data.technologies !== undefined && !Array.isArray(data.technologies)) {
    throw new Error(
      `Project ${slug} has invalid technologies field: must be an array`,
    );
  }

  if (data.company !== undefined && typeof data.company !== "string") {
    throw new Error(
      `Project ${slug} has invalid company field: must be a string`,
    );
  }

  if (data.role !== undefined && typeof data.role !== "string") {
    throw new Error(`Project ${slug} has invalid role field: must be a string`);
  }

  if (data.githubUrl !== undefined) {
    if (typeof data.githubUrl !== "string") {
      throw new Error(
        `Project ${slug} has invalid githubUrl field: must be a string`,
      );
    }
    try {
      new URL(data.githubUrl);
    } catch {
      throw new Error(
        `Project ${slug} has invalid githubUrl: ${data.githubUrl}`,
      );
    }
  }

  if (data.demoUrl !== undefined) {
    if (typeof data.demoUrl !== "string") {
      throw new Error(
        `Project ${slug} has invalid demoUrl field: must be a string`,
      );
    }
    try {
      new URL(data.demoUrl);
    } catch {
      throw new Error(`Project ${slug} has invalid demoUrl: ${data.demoUrl}`);
    }
  }

  if (
    data.experienceLink !== undefined &&
    typeof data.experienceLink !== "string"
  ) {
    throw new Error(
      `Project ${slug} has invalid experienceLink field: must be a string`,
    );
  }

  const stats = readingTime(content);

  return {
    slug,
    title: data.title,
    description: data.description,
    date: data.date,
    updated: data.updated,
    tags: data.tags,
    technologies: data.technologies,
    company: data.company,
    role: data.role,
    githubUrl: data.githubUrl,
    demoUrl: data.demoUrl,
    experienceLink: data.experienceLink,
    content,
    readingTime: stats.text,
  };
}

export function getAllProjects(): Project[] {
  const slugs = getAllProjectSlugs();
  const projects = slugs.map((slug) => getProjectBySlug(slug));

  return projects.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA; // Descending order (newest first)
  });
}
