import {
  type BaseContent,
  ContentManager,
  type ContentValidator,
  validators,
} from "./content";

export interface Project extends BaseContent {
  technologies?: string[];
  company?: string;
  role?: string;
  githubUrl?: string;
  demoUrl?: string;
  experienceLink?: string;
}

/**
 * Validator for project frontmatter
 */
const validateProject: ContentValidator<Project> = (data, _content, slug) => {
  return {
    title: validators.requireString(data, "title", slug),
    description: validators.requireString(data, "description", slug),
    date: validators.requireDate(data, "date", slug),
    updated: validators.optionalDate(data, "updated", slug),
    tags: validators.requireArray(data, "tags", slug),
    technologies: validators.optionalArray(data, "technologies", slug),
    company: validators.optionalString(data, "company", slug),
    role: validators.optionalString(data, "role", slug),
    githubUrl: validators.optionalUrl(data, "githubUrl", slug),
    demoUrl: validators.optionalUrl(data, "demoUrl", slug),
    experienceLink: validators.optionalString(data, "experienceLink", slug),
  };
};

/**
 * Project content manager
 */
const projectManager = new ContentManager<Project>({
  contentDir: "content/projects",
  validate: validateProject,
});

/**
 * Get all project slugs
 */
export function getAllProjectSlugs(): string[] {
  return projectManager.getAllSlugs();
}

/**
 * Get a single project by slug
 */
export function getProjectBySlug(slug: string): Project {
  return projectManager.getBySlug(slug);
}

/**
 * Get all projects, sorted by date (newest first)
 */
export function getAllProjects(): Project[] {
  return projectManager.getAll();
}
