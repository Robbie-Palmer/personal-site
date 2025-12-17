import fs from "fs";
import matter from "gray-matter";
import path from "path";
import { z } from "zod";

const projectsDirectory = path.join(process.cwd(), "content/projects");

const ProjectMetadataSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  tech_stack: z.array(z.string()),
  repo_url: z.url().optional(),
  demo_url: z.url().optional(),
  date: z.string(),
  updated: z.string().optional(),
});

const ADRFrontmatterSchema = z.object({
  title: z.string().min(1),
  date: z.string(),
  status: z.enum(["Accepted", "Rejected", "Deprecated", "Proposed"]),
  superseded_by: z.string().optional(),
});

export type ProjectMetadata = z.infer<typeof ProjectMetadataSchema>;

export interface Project extends ProjectMetadata {
  slug: string;
  content: string; // The Overview MDX content
  adrs: ADR[];
}

export type ADRFrontmatter = z.infer<typeof ADRFrontmatterSchema>;

export interface ADR extends ADRFrontmatter {
  slug: string;
  content: string;
}

export function getAllProjectSlugs() {
  if (!fs.existsSync(projectsDirectory)) {
    return [];
  }
  return fs.readdirSync(projectsDirectory).filter((file) => {
    return fs.statSync(path.join(projectsDirectory, file)).isDirectory();
  });
}

export function getProject(slug: string): Project {
  const indexRec = path.join(projectsDirectory, slug, "index.mdx");
  if (!fs.existsSync(indexRec)) {
    throw new Error(`Project not found: ${slug}`);
  }
  const fileContent = fs.readFileSync(indexRec, "utf8");
  const { data, content } = matter(fileContent);
  const parseResult = ProjectMetadataSchema.safeParse(data);
  if (!parseResult.success) {
    throw new Error(
      `Project ${slug} has invalid frontmatter: ${parseResult.error.message}`,
    );
  }
  const adrs = getProjectADRs(slug);
  return {
    slug,
    ...parseResult.data,
    content,
    adrs,
  };
}

export function getAllProjects(): Project[] {
  const slugs = getAllProjectSlugs();
  const projects = slugs.map((slug) => getProject(slug));
  // Sort by date descending (newest first)
  return projects.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });
}

function getProjectADRs(projectSlug: string): ADR[] {
  const adrDir = path.join(projectsDirectory, projectSlug, "adrs");
  if (!fs.existsSync(adrDir)) return [];
  const files = fs.readdirSync(adrDir).filter((file) => file.endsWith(".mdx"));
  return files
    .map((file) => {
      const filePath = path.join(adrDir, file);
      const fileContent = fs.readFileSync(filePath, "utf8");
      const { data, content } = matter(fileContent);
      const slug = file.replace(/\.mdx?$/, "");
      const parseResult = ADRFrontmatterSchema.safeParse(data);
      if (!parseResult.success) {
        throw new Error(
          `ADR ${projectSlug}/${slug} has invalid frontmatter: ${parseResult.error.message}`,
        );
      }
      return {
        slug,
        ...parseResult.data,
        content,
      };
    })
    .sort((a, b) => (a.slug > b.slug ? 1 : -1));
}

export function getProjectADR(projectSlug: string, adrSlug: string): ADR {
  const adrDir = path.join(projectsDirectory, projectSlug, "adrs");
  let filePath = path.join(adrDir, `${adrSlug}.mdx`);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(adrDir, `${adrSlug}.md`);
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`ADR not found: ${projectSlug}/${adrSlug}`);
  }
  const fileContent = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(fileContent);
  const parseResult = ADRFrontmatterSchema.safeParse(data);
  if (!parseResult.success) {
    throw new Error(
      `ADR ${projectSlug}/${adrSlug} has invalid frontmatter: ${parseResult.error.message}`,
    );
  }
  return {
    slug: adrSlug,
    ...parseResult.data,
    content,
  };
}
