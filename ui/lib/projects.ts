import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import { calculateReadingTime } from "@/lib/mdx";
import { validateSlug } from "@/lib/slugs";

const projectsDirectory = path.join(process.cwd(), "content/projects");

export const PROJECT_STATUSES = [
  "idea",
  "in_progress",
  "live",
  "archived",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

const ProjectMetadataSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  tech_stack: z.array(z.string()).min(1),
  repo_url: z.url().optional(),
  demo_url: z.url().optional(),
  date: z.iso.date(),
  updated: z.iso.date().optional(),
  status: z.enum(PROJECT_STATUSES),
});

const ADRFrontmatterSchema = z.object({
  title: z.string().min(1),
  date: z.iso.date(),
  status: z.enum(["Accepted", "Rejected", "Deprecated", "Proposed"]),
  superseded_by: z.string().optional(),
  tech_stack: z.array(z.string()).optional(),
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
  readingTime: string;
}

export interface ProjectADR extends ADR {
  projectSlug: string;
  projectTitle: string;
}

export function getAllProjectSlugs() {
  if (!fs.existsSync(projectsDirectory)) {
    return [];
  }
  return fs.readdirSync(projectsDirectory).filter((file) => {
    if (fs.statSync(path.join(projectsDirectory, file)).isDirectory()) {
      validateSlug(file);
      return true;
    }
    return false;
  });
}

function getProjectADRs(projectSlug: string): ADR[] {
  const adrDir = path.join(projectsDirectory, projectSlug, "adrs");
  if (!fs.existsSync(adrDir)) return [];
  const files = fs.readdirSync(adrDir).filter((file) => file.endsWith(".mdx"));
  for (const file of files) {
    validateSlug(file);
  }
  return files
    .map((file) => {
      const filePath = path.join(adrDir, file);
      const fileContent = fs.readFileSync(filePath, "utf8");
      const { data, content } = matter(fileContent);
      const slug = file.replace(/\.mdx$/, "");
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
        readingTime: calculateReadingTime(content),
      };
    })
    .sort((a, b) => (a.slug > b.slug ? 1 : -1));
}

export function getProject(slug: string): Project {
  const indexPath = path.join(projectsDirectory, slug, "index.mdx");
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Project not found: ${slug}`);
  }
  const fileContent = fs.readFileSync(indexPath, "utf8");
  const { data, content } = matter(fileContent);
  const parseResult = ProjectMetadataSchema.safeParse(data);
  if (!parseResult.success) {
    throw new Error(
      `Project ${slug} has invalid frontmatter: ${parseResult.error.message}`,
    );
  }
  const adrs = getProjectADRs(slug);
  const adrTechStack = adrs
    .filter((adr) => adr.status === "Accepted" && adr.tech_stack)
    .flatMap((adr) => adr.tech_stack || []);
  const mergedTechStack = Array.from(
    new Set([...parseResult.data.tech_stack, ...adrTechStack]),
  ).sort();
  return {
    slug,
    ...parseResult.data,
    tech_stack: mergedTechStack,
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

export function getAllADRs(): ProjectADR[] {
  const projects = getAllProjects();
  const allADRs = projects.flatMap((project) =>
    project.adrs.map((adr) => ({
      ...adr,
      projectSlug: project.slug,
      projectTitle: project.title,
    })),
  );

  return allADRs.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });
}

export function getProjectADR(projectSlug: string, adrSlug: string): ADR {
  const adrDir = path.join(projectsDirectory, projectSlug, "adrs");
  const filePath = path.join(adrDir, `${adrSlug}.mdx`);
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
    readingTime: calculateReadingTime(content),
  };
}
