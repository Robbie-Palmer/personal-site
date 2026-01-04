import fs from "node:fs";
import path from "node:path";
import { isValid, parse } from "date-fns";
import matter from "gray-matter";
import readingTime from "reading-time";
import { technologies as definedTechnologies } from "../../content/technologies";
import {
  type ADR,
  type ADRRelations,
  ADRSchema,
  type ADRSlug,
} from "../domain/adr/adr";
import {
  type BlogPost,
  BlogPostSchema,
  type BlogRelations,
  type BlogSlug,
} from "../domain/blog/blogPost";
import {
  type Project,
  type ProjectRelations,
  ProjectSchema,
  type ProjectSlug,
} from "../domain/project/project";
import {
  type JobRole,
  JobRoleSchema,
  type RoleRelations,
  type RoleSlug,
} from "../domain/role/jobRole";
import {
  type Technology,
  TechnologySchema,
  type TechnologySlug,
} from "../domain/technology/technology";
import { getAllExperience, getExperienceSlug } from "../experience";
import { normalizeSlug } from "../slugs";
import {
  buildContentGraph,
  type ContentGraph,
  createEmptyRelationData,
  type RelationData,
} from "./graph";

// Validation types
export type DomainValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      schemaErrors?: import("zod").ZodError;
      referentialErrors?: ReferentialIntegrityError[];
    };

export interface ReferentialIntegrityError {
  type: "missing_reference" | "invalid_reference" | "circular_reference";
  entity: string;
  field: string;
  value: string;
  message: string;
}

const CONTENT_DIR = path.join(process.cwd(), "content");
const BLOG_DIR = path.join(CONTENT_DIR, "blog");
const PROJECTS_DIR = path.join(CONTENT_DIR, "projects");
const BUILDING_PHILOSOPHY_PATH = path.join(
  PROJECTS_DIR,
  "building-philosophy.mdx",
);

export function loadTechnologies(): Map<TechnologySlug, Technology> {
  const techMap = new Map<TechnologySlug, Technology>();

  for (const techContent of definedTechnologies) {
    const slug = (techContent.slug ||
      normalizeSlug(techContent.name)) as TechnologySlug;
    const tech: Technology = {
      ...techContent,
      slug,
    };
    techMap.set(slug, tech);
  }

  return techMap;
}

// Validate that all referenced technologies are defined
export function validateTechnologyReferences(
  technologies: Map<TechnologySlug, Technology>,
): void {
  const missingTechs = new Set<string>();
  const collectMissingTech = (name: string, source: string) => {
    const slug = normalizeSlug(name);
    if (!technologies.has(slug)) {
      missingTechs.add(`"${name}" (referenced in ${source})`);
    }
  };

  // Check experience technologies
  const experiences = getAllExperience();
  for (const exp of experiences) {
    for (const tech of exp.technologies) {
      collectMissingTech(tech, `experience: ${exp.company}`);
    }
  }

  // Check project and ADR technologies
  if (fs.existsSync(PROJECTS_DIR)) {
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
          for (const tech of data.tech_stack) {
            collectMissingTech(tech, `project: ${projectSlug}`);
          }
        }

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
              for (const tech of adrData.tech_stack) {
                collectMissingTech(tech, `ADR: ${projectSlug}/${adrFile}`);
              }
            }
          });
        }
      }
    });
  }

  // Check blog technologies
  if (fs.existsSync(BLOG_DIR)) {
    const blogFiles = fs
      .readdirSync(BLOG_DIR)
      .filter((f) => f.endsWith(".mdx") && f !== "README.mdx");
    blogFiles.forEach((blogFile) => {
      const blogPath = path.join(BLOG_DIR, blogFile);
      const blogContent = fs.readFileSync(blogPath, "utf-8");
      const { data: blogData } = matter(blogContent);
      if (Array.isArray(blogData.technologies)) {
        for (const tech of blogData.technologies) {
          collectMissingTech(tech, `blog: ${blogFile}`);
        }
      }
    });
  }

  if (missingTechs.size > 0) {
    const errorMessage = [
      "\n❌ ERROR: The following technologies are referenced but not defined in content/technologies.ts:",
      "",
      ...Array.from(missingTechs)
        .sort()
        .map((tech) => `  - ${tech}`),
      "",
      "Please add these technologies to content/technologies.ts",
      "",
    ].join("\n");
    throw new Error(errorMessage);
  }
}

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
  // Derive slug if not provided
  const slug = (result.data.slug ||
    normalizeSlug(result.data.name)) as TechnologySlug;
  return {
    success: true,
    data: {
      ...result.data,
      slug,
    },
  };
}

interface BlogLoadResult {
  entities: Map<BlogSlug, BlogPost>;
  relations: Map<BlogSlug, BlogRelations>;
}

export function loadBlogPosts(): BlogLoadResult {
  const entities = new Map<BlogSlug, BlogPost>();
  const relations = new Map<BlogSlug, BlogRelations>();

  if (!fs.existsSync(BLOG_DIR)) {
    return { entities, relations };
  }
  const files = fs
    .readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith(".mdx") && file !== "README.mdx");

  files.forEach((filename) => {
    const slug = filename.replace(/\.mdx$/, "");
    const filePath = path.join(BLOG_DIR, filename);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(fileContent);

    const post: BlogPost = {
      slug,
      title: data.title,
      description: data.description,
      date: data.date,
      updated: data.updated,
      canonicalUrl: data.canonical,
      content,
      readingTime: readingTime(content).text,
      image: data.image,
      imageAlt: data.imageAlt,
    };

    const blogRelations: BlogRelations = {
      technologies: (data.technologies || []).map((tech: string) =>
        normalizeSlug(tech),
      ),
      tags: data.tags || [],
    };

    const validation = validateBlogPost(post);
    if (validation.success) {
      entities.set(slug, validation.data);
      relations.set(slug, blogRelations);
    } else {
      console.error(
        `Failed to validate blog post ${slug}:`,
        validation.schemaErrors,
      );
      throw new Error(`Blog post ${slug} failed validation`);
    }
  });

  return { entities, relations };
}

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

interface ProjectLoadResult {
  entities: Map<ProjectSlug, Project>;
  relations: Map<ProjectSlug, ProjectRelations>;
}

export function loadProjects(): ProjectLoadResult {
  const entities = new Map<ProjectSlug, Project>();
  const relations = new Map<ProjectSlug, ProjectRelations>();

  if (!fs.existsSync(PROJECTS_DIR)) {
    return { entities, relations };
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

    const technologies: TechnologySlug[] = (data.tech_stack || []).map(
      (tech: string) => normalizeSlug(tech),
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
    };

    const projectRelations: ProjectRelations = {
      technologies,
      adrs: adrSlugs,
    };

    const validation = validateProject(project);
    if (validation.success) {
      entities.set(projectSlug, validation.data);
      relations.set(projectSlug, projectRelations);
    } else {
      console.error(
        `Failed to validate project ${projectSlug}:`,
        validation.schemaErrors,
      );
      throw new Error(`Project ${projectSlug} failed validation`);
    }
  });

  return { entities, relations };
}

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

interface ADRLoadResult {
  entities: Map<ADRSlug, ADR>;
  relations: Map<ADRSlug, ADRRelations>;
}

export function loadADRs(): ADRLoadResult {
  const entities = new Map<ADRSlug, ADR>();
  const relations = new Map<ADRSlug, ADRRelations>();

  if (!fs.existsSync(PROJECTS_DIR)) {
    return { entities, relations };
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

      const technologies: TechnologySlug[] = (data.tech_stack || []).map(
        (tech: string) => normalizeSlug(tech),
      );

      const adr: ADR = {
        slug: adrSlug,
        title: data.title,
        date: data.date,
        status: data.status,
        supersededBy: data.superseded_by,
        content,
        readingTime: readingTime(content).text,
      };

      const adrRelations: ADRRelations = {
        project: projectSlug,
        technologies,
      };

      const validation = validateADR(adr);
      if (validation.success) {
        entities.set(adrSlug, validation.data);
        relations.set(adrSlug, adrRelations);
      } else {
        console.error(
          `Failed to validate ADR ${adrSlug}:`,
          validation.schemaErrors,
        );
        throw new Error(`ADR ${adrSlug} failed validation`);
      }
    });
  });

  return { entities, relations };
}

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

interface RoleLoadResult {
  entities: Map<RoleSlug, JobRole>;
  relations: Map<RoleSlug, RoleRelations>;
}

export function loadJobRoles(): RoleLoadResult {
  const entities = new Map<RoleSlug, JobRole>();
  const relations = new Map<RoleSlug, RoleRelations>();

  const experiences = getAllExperience();
  for (const exp of experiences) {
    const slug = getExperienceSlug(exp);
    const technologies: TechnologySlug[] = exp.technologies.map((tech) =>
      normalizeSlug(tech),
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
    };

    const roleRelations: RoleRelations = {
      technologies,
    };

    const validation = validateJobRole(role);
    if (validation.success) {
      entities.set(slug, validation.data);
      relations.set(slug, roleRelations);
    } else {
      console.error(
        `Failed to validate job role ${slug}:`,
        validation.schemaErrors,
      );
      throw new Error(`Job role ${slug} failed validation`);
    }
  }

  return { entities, relations };
}

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

export function loadBuildingPhilosophy(): string {
  if (!fs.existsSync(BUILDING_PHILOSOPHY_PATH)) {
    return "";
  }
  const fileContent = fs.readFileSync(BUILDING_PHILOSOPHY_PATH, "utf-8");
  const { content } = matter(fileContent);
  return content;
}

interface ValidationInput {
  technologies: Map<TechnologySlug, Technology>;
  adrs: Map<ADRSlug, ADR>;
  projects: Map<ProjectSlug, Project>;
  blogRelations: Map<BlogSlug, BlogRelations>;
  projectRelations: Map<ProjectSlug, ProjectRelations>;
  adrRelations: Map<ADRSlug, ADRRelations>;
  roleRelations: Map<RoleSlug, RoleRelations>;
}

export function validateReferentialIntegrity(
  input: ValidationInput,
): ReferentialIntegrityError[] {
  const errors: ReferentialIntegrityError[] = [];

  const checkTech = (slug: TechnologySlug, entity: string, field: string) => {
    if (!input.technologies.has(slug)) {
      errors.push({
        type: "missing_reference",
        entity,
        field,
        value: slug,
        message: `Technology '${slug}' referenced by ${entity}.${field} does not exist`,
      });
    }
  };

  input.blogRelations.forEach((relations, blogSlug) => {
    relations.technologies.forEach((techSlug) => {
      checkTech(techSlug, `BlogPost[${blogSlug}]`, "technologies");
    });
  });

  input.projectRelations.forEach((relations, projectSlug) => {
    relations.technologies.forEach((techSlug) => {
      checkTech(techSlug, `Project[${projectSlug}]`, "technologies");
    });
    relations.adrs.forEach((adrSlug) => {
      if (!input.adrs.has(adrSlug)) {
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

  input.adrRelations.forEach((relations, adrSlug) => {
    if (!input.projects.has(relations.project)) {
      errors.push({
        type: "missing_reference",
        entity: `ADR[${adrSlug}]`,
        field: "project",
        value: relations.project,
        message: `Project '${relations.project}' referenced by ADR '${adrSlug}' does not exist`,
      });
    }
    relations.technologies.forEach((techSlug) => {
      checkTech(techSlug, `ADR[${adrSlug}]`, "technologies");
    });
    const adr = input.adrs.get(adrSlug);
    if (adr?.supersededBy && !input.adrs.has(adr.supersededBy)) {
      errors.push({
        type: "missing_reference",
        entity: `ADR[${adrSlug}]`,
        field: "supersededBy",
        value: adr.supersededBy,
        message: `ADR '${adr.supersededBy}' referenced by supersededBy does not exist`,
      });
    }
  });

  input.roleRelations.forEach((relations, roleSlug) => {
    relations.technologies.forEach((techSlug) => {
      checkTech(techSlug, `JobRole[${roleSlug}]`, "technologies");
    });
  });

  return errors;
}

export interface DomainRepository {
  technologies: Map<TechnologySlug, Technology>;
  blogs: Map<BlogSlug, BlogPost>;
  projects: Map<ProjectSlug, Project>;
  adrs: Map<ADRSlug, ADR>;
  roles: Map<RoleSlug, JobRole>;
  graph: ContentGraph;
  buildingPhilosophy: string;
  referentialIntegrityErrors: ReferentialIntegrityError[];
}

interface LoaderResults {
  blogs: BlogLoadResult;
  projects: ProjectLoadResult;
  adrs: ADRLoadResult;
  roles: RoleLoadResult;
}

function buildRelationDataFromLoaders(loaders: LoaderResults): RelationData {
  const relations = createEmptyRelationData();

  for (const [slug, projectRels] of loaders.projects.relations) {
    relations.projectTechnologies.set(slug, projectRels.technologies);
    relations.projectADRs.set(slug, projectRels.adrs);
  }

  for (const [slug, blogRels] of loaders.blogs.relations) {
    relations.blogTechnologies.set(slug, blogRels.technologies);
    relations.blogTags.set(slug, blogRels.tags);
  }

  for (const [slug, adrRels] of loaders.adrs.relations) {
    relations.adrTechnologies.set(slug, adrRels.technologies);
    relations.adrProject.set(slug, adrRels.project);
  }

  // Handle supersededBy from ADR entities
  for (const [slug, adr] of loaders.adrs.entities) {
    if (adr.supersededBy) {
      relations.adrSupersededBy.set(adr.supersededBy, slug);
    }
  }

  for (const [slug, roleRels] of loaders.roles.relations) {
    relations.roleTechnologies.set(slug, roleRels.technologies);
  }

  return relations;
}

export function loadDomainRepository(): DomainRepository {
  const technologies = loadTechnologies();
  validateTechnologyReferences(technologies);
  const blogsResult = loadBlogPosts();
  const projectsResult = loadProjects();
  const adrsResult = loadADRs();
  const rolesResult = loadJobRoles();
  const buildingPhilosophy = loadBuildingPhilosophy();

  const referentialIntegrityErrors = validateReferentialIntegrity({
    technologies,
    adrs: adrsResult.entities,
    projects: projectsResult.entities,
    blogRelations: blogsResult.relations,
    projectRelations: projectsResult.relations,
    adrRelations: adrsResult.relations,
    roleRelations: rolesResult.relations,
  });

  if (referentialIntegrityErrors.length > 0) {
    console.error("Referential integrity errors found:");
    referentialIntegrityErrors.forEach((err) => {
      console.error(`  - ${err.message}`);
    });
    throw new Error(
      `Found ${referentialIntegrityErrors.length} referential integrity errors`,
    );
  }

  const loaders: LoaderResults = {
    blogs: blogsResult,
    projects: projectsResult,
    adrs: adrsResult,
    roles: rolesResult,
  };

  const relations = buildRelationDataFromLoaders(loaders);
  const graph = buildContentGraph({
    technologySlugs: technologies.keys(),
    projectSlugs: projectsResult.entities.keys(),
    relations,
  });

  return {
    technologies,
    blogs: blogsResult.entities,
    projects: projectsResult.entities,
    adrs: adrsResult.entities,
    roles: rolesResult.entities,
    graph,
    buildingPhilosophy,
    referentialIntegrityErrors,
  };
}
