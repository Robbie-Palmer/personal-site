import fs from "fs";
import matter from "gray-matter";
import path from "path";

const projectsDirectory = path.join(process.cwd(), "content/projects");

export interface ProjectMetadata {
  title: string;
  description: string;
  tech_stack: string[];
  repo_url?: string;
  demo_url?: string;
  date: string;
  updated?: string;
}

export interface Project extends ProjectMetadata {
  slug: string;
  content: string; // The Overview MDX content
  adrs: ADR[];
}

export interface ADR {
  slug: string;
  title: string;
  date: string;
  status: "Accepted" | "Rejected" | "Deprecated" | "Proposed";
  superseded_by?: string;
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
  if (!data.title || !data.description || !data.date || !data.tech_stack) {
    throw new Error(`Project ${slug} is missing required frontmatter fields`);
  }
  const metadata: ProjectMetadata = {
    title: data.title,
    description: data.description,
    tech_stack: data.tech_stack,
    repo_url: data.repo_url,
    demo_url: data.demo_url,
    date: data.date,
    updated: data.updated,
  };
  const adrs = getProjectADRs(slug);
  return {
    slug,
    ...metadata,
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
      return {
        slug,
        title: data.title,
        date: data.date,
        status: data.status,
        superseded_by: data.superseded_by,
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
  return {
    slug: adrSlug,
    title: data.title,
    date: data.date,
    status: data.status,
    superseded_by: data.superseded_by,
    content,
  };
}
