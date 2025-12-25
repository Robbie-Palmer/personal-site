import { isValid, parse } from "date-fns";
import fs from "fs";
import matter from "gray-matter";
import path from "path";
import readingTime from "reading-time";
import { getAllExperience } from "../experience";
import { TECH_URLS } from "../tech-icons";
import {
  type ADR,
  ADRSchema,
  type ADRSlug,
  type BlogPost,
  BlogPostSchema,
  type BlogSlug,
  type DomainValidationResult,
  type JobRole,
  JobRoleSchema,
  type Project,
  ProjectSchema,
  type ProjectSlug,
  type ReferentialIntegrityError,
  type RoleSlug,
  type Technology,
  TechnologySchema,
  type TechnologySlug,
} from "./models";

// ============================================================================
// Configuration
// ============================================================================

const CONTENT_DIR = path.join(process.cwd(), "content");
const BLOG_DIR = path.join(CONTENT_DIR, "blog");
const PROJECTS_DIR = path.join(CONTENT_DIR, "projects");

// ============================================================================
// Technology Repository
// ============================================================================

/**
 * Builds a canonical Technology catalog by scanning all content types
 * and extracting technology references.
 */
export function loadTechnologies(): Map<TechnologySlug, Technology> {
  const techMap = new Map<TechnologySlug, Technology>();

  // Helper to normalize technology names to slugs
  const normalizeSlug = (name: string): string => {
    return name.toLowerCase().trim();
  };

  // Helper to add or update technology
  const addTech = (name: string) => {
    const slug = normalizeSlug(name);
    if (!techMap.has(slug)) {
      techMap.set(slug, {
        slug,
        name,
        description: undefined,
        website: TECH_URLS[slug] || TECH_URLS[name],
        brandColor: undefined,
        iconSlug: undefined,
        relations: {
          blogs: [],
          adrs: [],
          projects: [],
          roles: [],
        },
      });
    }
  };

  // Scan all content to build tech catalog
  const experiences = getAllExperience();
  experiences.forEach((exp) => {
    exp.technologies.forEach((tech) => addTech(tech));
  });

  // Scan projects and ADRs
  const projectDirs = fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  projectDirs.forEach((projectSlug) => {
    const projectPath = path.join(PROJECTS_DIR, projectSlug, "index.mdx");
    if (fs.existsSync(projectPath)) {
      const fileContent = fs.readFileSync(projectPath, "utf-8");
      const { data } = matter(fileContent);

      if (Array.isArray(data.tech_stack)) {
        data.tech_stack.forEach((tech: string) => addTech(tech));
      }

      // Scan ADRs
      const adrsDir = path.join(PROJECTS_DIR, projectSlug, "adrs");
      if (fs.existsSync(adrsDir)) {
        const adrFiles = fs
          .readdirSync(adrsDir)
          .filter((f) => f.endsWith(".mdx"));
        adrFiles.forEach((adrFile) => {
          const adrPath = path.join(adrsDir, adrFile);
          const adrContent = fs.readFileSync(adrPath, "utf-8");
          const { data: adrData } = matter(adrContent);

          if (Array.isArray(adrData.tech_stack)) {
            adrData.tech_stack.forEach((tech: string) => addTech(tech));
          }
        });
      }
    }
  });

  return techMap;
}

/**
 * Validates a Technology against the schema
 */
export function validateTechnology(
  tech: unknown,
): DomainValidationResult<Technology> {
  const result = TechnologySchema.safeParse(tech);

  if (!result.success) {
    return {
      success: false,
      schemaErrors: result.error,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

// ============================================================================
// BlogPost Repository
// ============================================================================

/**
 * Loads all blog posts from the content directory
 */
export function loadBlogPosts(): Map<BlogSlug, BlogPost> {
  const blogMap = new Map<BlogSlug, BlogPost>();

  if (!fs.existsSync(BLOG_DIR)) {
    return blogMap;
  }

  const files = fs
    .readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith(".mdx") && file !== "README.mdx");

  files.forEach((filename) => {
    const slug = filename.replace(/\.mdx$/, "");
    const filePath = path.join(BLOG_DIR, filename);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(fileContent);

    // Extract technologies from tags (basic inference)
    const technologies: TechnologySlug[] = [];
    // Could enhance this with more sophisticated tech extraction from content/tags

    const post: BlogPost = {
      slug,
      title: data.title,
      description: data.description,
      date: data.date,
      updated: data.updated,
      tags: data.tags || [],
      canonicalUrl: data.canonical,
      content,
      readingTime: readingTime(content).text,
      image: data.image,
      imageAlt: data.imageAlt,
      relations: {
        technologies,
      },
    };

    const validation = validateBlogPost(post);
    if (validation.success) {
      blogMap.set(slug, validation.data);
    } else {
      console.error(
        `Failed to validate blog post ${slug}:`,
        validation.schemaErrors,
      );
      throw new Error(`Blog post ${slug} failed validation`);
    }
  });

  return blogMap;
}

/**
 * Validates a BlogPost against the schema
 */
export function validateBlogPost(
  post: unknown,
): DomainValidationResult<BlogPost> {
  const result = BlogPostSchema.safeParse(post);

  if (!result.success) {
    return {
      success: false,
      schemaErrors: result.error,
    };
  }

  // Additional validation for dates
  const dateValid = isValid(parse(result.data.date, "yyyy-MM-dd", new Date()));
  if (!dateValid) {
    return {
      success: false,
      referentialErrors: [
        {
          type: "invalid_reference",
          entity: "BlogPost",
          field: "date",
          value: result.data.date,
          message: `Invalid date format: ${result.data.date}`,
        },
      ],
    };
  }

  if (result.data.updated) {
    const updatedValid = isValid(
      parse(result.data.updated, "yyyy-MM-dd", new Date()),
    );
    if (!updatedValid) {
      return {
        success: false,
        referentialErrors: [
          {
            type: "invalid_reference",
            entity: "BlogPost",
            field: "updated",
            value: result.data.updated,
            message: `Invalid updated date format: ${result.data.updated}`,
          },
        ],
      };
    }
  }

  return {
    success: true,
    data: result.data,
  };
}

// ============================================================================
// Project & ADR Repository
// ============================================================================

/**
 * Loads all projects from the content directory
 */
export function loadProjects(): Map<ProjectSlug, Project> {
  const projectMap = new Map<ProjectSlug, Project>();

  if (!fs.existsSync(PROJECTS_DIR)) {
    return projectMap;
  }

  const projectDirs = fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  projectDirs.forEach((projectSlug) => {
    const projectPath = path.join(PROJECTS_DIR, projectSlug, "index.mdx");

    if (!fs.existsSync(projectPath)) {
      return;
    }

    const fileContent = fs.readFileSync(projectPath, "utf-8");
    const { data, content } = matter(fileContent);

    // Load ADRs for this project
    const adrSlugs: ADRSlug[] = [];
    const adrsDir = path.join(PROJECTS_DIR, projectSlug, "adrs");
    if (fs.existsSync(adrsDir)) {
      const adrFiles = fs
        .readdirSync(adrsDir)
        .filter((f) => f.endsWith(".mdx"))
        .sort();

      adrFiles.forEach((adrFile) => {
        const adrSlug = adrFile.replace(/\.mdx$/, "");
        adrSlugs.push(adrSlug);
      });
    }

    // Normalize tech_stack to technology slugs
    const technologies: TechnologySlug[] = (data.tech_stack || []).map(
      (tech: string) => tech.toLowerCase().trim(),
    );

    const project: Project = {
      slug: projectSlug,
      title: data.title,
      description: data.description,
      date: data.date,
      updated: data.updated,
      status: data.status,
      repoUrl: data.repo_url,
      demoUrl: data.demo_url,
      content,
      relations: {
        technologies,
        adrs: adrSlugs,
      },
    };

    const validation = validateProject(project);
    if (validation.success) {
      projectMap.set(projectSlug, validation.data);
    } else {
      console.error(
        `Failed to validate project ${projectSlug}:`,
        validation.schemaErrors,
      );
      throw new Error(`Project ${projectSlug} failed validation`);
    }
  });

  return projectMap;
}

/**
 * Validates a Project against the schema
 */
export function validateProject(
  project: unknown,
): DomainValidationResult<Project> {
  const result = ProjectSchema.safeParse(project);

  if (!result.success) {
    return {
      success: false,
      schemaErrors: result.error,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

/**
 * Loads all ADRs from all projects
 */
export function loadADRs(): Map<ADRSlug, ADR> {
  const adrMap = new Map<ADRSlug, ADR>();

  if (!fs.existsSync(PROJECTS_DIR)) {
    return adrMap;
  }

  const projectDirs = fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  projectDirs.forEach((projectSlug) => {
    const adrsDir = path.join(PROJECTS_DIR, projectSlug, "adrs");

    if (!fs.existsSync(adrsDir)) {
      return;
    }

    const adrFiles = fs.readdirSync(adrsDir).filter((f) => f.endsWith(".mdx"));

    adrFiles.forEach((adrFile) => {
      const adrSlug = adrFile.replace(/\.mdx$/, "");
      const adrPath = path.join(adrsDir, adrFile);
      const fileContent = fs.readFileSync(adrPath, "utf-8");
      const { data, content } = matter(fileContent);

      // Normalize tech_stack to technology slugs
      const technologies: TechnologySlug[] = (data.tech_stack || []).map(
        (tech: string) => tech.toLowerCase().trim(),
      );

      const adr: ADR = {
        slug: adrSlug,
        title: data.title,
        date: data.date,
        status: data.status,
        supersededBy: data.superseded_by,
        content,
        readingTime: readingTime(content).text,
        relations: {
          project: projectSlug,
          technologies,
        },
      };

      const validation = validateADR(adr);
      if (validation.success) {
        adrMap.set(adrSlug, validation.data);
      } else {
        console.error(
          `Failed to validate ADR ${adrSlug}:`,
          validation.schemaErrors,
        );
        throw new Error(`ADR ${adrSlug} failed validation`);
      }
    });
  });

  return adrMap;
}

/**
 * Validates an ADR against the schema
 */
export function validateADR(adr: unknown): DomainValidationResult<ADR> {
  const result = ADRSchema.safeParse(adr);

  if (!result.success) {
    return {
      success: false,
      schemaErrors: result.error,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

// ============================================================================
// JobRole Repository
// ============================================================================

/**
 * Loads all job roles (currently from hardcoded experience data)
 */
export function loadJobRoles(): Map<RoleSlug, JobRole> {
  const roleMap = new Map<RoleSlug, JobRole>();

  const experiences = getAllExperience();

  experiences.forEach((exp, index) => {
    // Generate slug from company and title
    const slug = `${exp.company.toLowerCase().replace(/\s+/g, "-")}-${index}`;

    // Normalize technology names to slugs
    const technologies: TechnologySlug[] = exp.technologies.map((tech) =>
      tech.toLowerCase().trim(),
    );

    const role: JobRole = {
      slug,
      company: exp.company,
      companyUrl: exp.company_url,
      logoPath: exp.logo_path,
      title: exp.title,
      location: exp.location,
      startDate: exp.startDate,
      endDate: exp.endDate,
      description: exp.description,
      responsibilities: exp.responsibilities,
      relations: {
        technologies,
      },
    };

    const validation = validateJobRole(role);
    if (validation.success) {
      roleMap.set(slug, validation.data);
    } else {
      console.error(
        `Failed to validate job role ${slug}:`,
        validation.schemaErrors,
      );
      throw new Error(`Job role ${slug} failed validation`);
    }
  });

  return roleMap;
}

/**
 * Validates a JobRole against the schema
 */
export function validateJobRole(
  role: unknown,
): DomainValidationResult<JobRole> {
  const result = JobRoleSchema.safeParse(role);

  if (!result.success) {
    return {
      success: false,
      schemaErrors: result.error,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

// ============================================================================
// Referential Integrity Validation
// ============================================================================

/**
 * Validates referential integrity across all domain models
 */
export function validateReferentialIntegrity(
  technologies: Map<TechnologySlug, Technology>,
  blogs: Map<BlogSlug, BlogPost>,
  projects: Map<ProjectSlug, Project>,
  adrs: Map<ADRSlug, ADR>,
  roles: Map<RoleSlug, JobRole>,
): ReferentialIntegrityError[] {
  const errors: ReferentialIntegrityError[] = [];

  // Helper to check if technology exists
  const checkTech = (slug: TechnologySlug, entity: string, field: string) => {
    if (!technologies.has(slug)) {
      errors.push({
        type: "missing_reference",
        entity,
        field,
        value: slug,
        message: `Technology '${slug}' referenced by ${entity}.${field} does not exist`,
      });
    }
  };

  // Validate blog post technology references
  blogs.forEach((blog, blogSlug) => {
    blog.relations.technologies.forEach((techSlug) => {
      checkTech(techSlug, `BlogPost[${blogSlug}]`, "technologies");
    });
  });

  // Validate project references
  projects.forEach((project, projectSlug) => {
    // Check technologies
    project.relations.technologies.forEach((techSlug) => {
      checkTech(techSlug, `Project[${projectSlug}]`, "technologies");
    });

    // Check ADR references
    project.relations.adrs.forEach((adrSlug) => {
      if (!adrs.has(adrSlug)) {
        errors.push({
          type: "missing_reference",
          entity: `Project[${projectSlug}]`,
          field: "adrs",
          value: adrSlug,
          message: `ADR '${adrSlug}' referenced by project '${projectSlug}' does not exist`,
        });
      }
    });
  });

  // Validate ADR references
  adrs.forEach((adr, adrSlug) => {
    // Check project reference
    if (!projects.has(adr.relations.project)) {
      errors.push({
        type: "missing_reference",
        entity: `ADR[${adrSlug}]`,
        field: "project",
        value: adr.relations.project,
        message: `Project '${adr.relations.project}' referenced by ADR '${adrSlug}' does not exist`,
      });
    }

    // Check technologies
    adr.relations.technologies.forEach((techSlug) => {
      checkTech(techSlug, `ADR[${adrSlug}]`, "technologies");
    });

    // Check superseded_by reference (if it exists)
    if (adr.supersededBy && !adrs.has(adr.supersededBy)) {
      errors.push({
        type: "missing_reference",
        entity: `ADR[${adrSlug}]`,
        field: "supersededBy",
        value: adr.supersededBy,
        message: `ADR '${adr.supersededBy}' referenced by supersededBy does not exist`,
      });
    }
  });

  // Validate job role technology references
  roles.forEach((role, roleSlug) => {
    role.relations.technologies.forEach((techSlug) => {
      checkTech(techSlug, `JobRole[${roleSlug}]`, "technologies");
    });
  });

  return errors;
}

// ============================================================================
// Build Technology Relations
// ============================================================================

/**
 * Builds bidirectional relationships between technologies and other entities
 */
export function buildTechnologyRelations(
  technologies: Map<TechnologySlug, Technology>,
  blogs: Map<BlogSlug, BlogPost>,
  projects: Map<ProjectSlug, Project>,
  adrs: Map<ADRSlug, ADR>,
  roles: Map<RoleSlug, JobRole>,
): void {
  // Reset all relations
  technologies.forEach((tech) => {
    tech.relations.blogs = [];
    tech.relations.adrs = [];
    tech.relations.projects = [];
    tech.relations.roles = [];
  });

  // Build blog relations
  blogs.forEach((blog, blogSlug) => {
    blog.relations.technologies.forEach((techSlug) => {
      const tech = technologies.get(techSlug);
      if (tech && !tech.relations.blogs.includes(blogSlug)) {
        tech.relations.blogs.push(blogSlug);
      }
    });
  });

  // Build project relations
  projects.forEach((project, projectSlug) => {
    project.relations.technologies.forEach((techSlug) => {
      const tech = technologies.get(techSlug);
      if (tech && !tech.relations.projects.includes(projectSlug)) {
        tech.relations.projects.push(projectSlug);
      }
    });
  });

  // Build ADR relations
  adrs.forEach((adr, adrSlug) => {
    adr.relations.technologies.forEach((techSlug) => {
      const tech = technologies.get(techSlug);
      if (tech && !tech.relations.adrs.includes(adrSlug)) {
        tech.relations.adrs.push(adrSlug);
      }
    });
  });

  // Build role relations
  roles.forEach((role, roleSlug) => {
    role.relations.technologies.forEach((techSlug) => {
      const tech = technologies.get(techSlug);
      if (tech && !tech.relations.roles.includes(roleSlug)) {
        tech.relations.roles.push(roleSlug);
      }
    });
  });
}

// ============================================================================
// Master Repository Loader
// ============================================================================

export interface DomainRepository {
  technologies: Map<TechnologySlug, Technology>;
  blogs: Map<BlogSlug, BlogPost>;
  projects: Map<ProjectSlug, Project>;
  adrs: Map<ADRSlug, ADR>;
  roles: Map<RoleSlug, JobRole>;
  referentialIntegrityErrors: ReferentialIntegrityError[];
}

/**
 * Loads all domain models and validates referential integrity
 */
export function loadDomainRepository(): DomainRepository {
  // Load all content
  const technologies = loadTechnologies();
  const blogs = loadBlogPosts();
  const projects = loadProjects();
  const adrs = loadADRs();
  const roles = loadJobRoles();

  // Build bidirectional relations
  buildTechnologyRelations(technologies, blogs, projects, adrs, roles);

  // Validate referential integrity
  const referentialIntegrityErrors = validateReferentialIntegrity(
    technologies,
    blogs,
    projects,
    adrs,
    roles,
  );

  // Throw error if there are integrity violations
  if (referentialIntegrityErrors.length > 0) {
    console.error("Referential integrity errors found:");
    referentialIntegrityErrors.forEach((err) => {
      console.error(`  - ${err.message}`);
    });
    throw new Error(
      `Found ${referentialIntegrityErrors.length} referential integrity errors`,
    );
  }

  return {
    technologies,
    blogs,
    projects,
    adrs,
    roles,
    referentialIntegrityErrors,
  };
}
