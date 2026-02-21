import fs from "node:fs";
import path from "node:path";
import { isValid, parse } from "date-fns";
import matter from "gray-matter";
import readingTime from "reading-time";
import { experiences as definedExperiences } from "../../content/experience";
import { technologies as definedTechnologies } from "../../content/technologies";
import {
  type ADR,
  type ADRRef,
  type ADRRelations,
  ADRSchema,
  makeADRRef,
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
import { normalizeSlug } from "../generic/slugs";
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
  for (const exp of definedExperiences) {
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
      role: data.role ? normalizeSlug(data.role) : undefined,
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

    const adrRefs: ADRRef[] = [];
    const adrsDir = path.join(PROJECTS_DIR, projectSlug, "adrs");
    if (fs.existsSync(adrsDir)) {
      const adrFiles = fs
        .readdirSync(adrsDir)
        .filter((f) => f.endsWith(".mdx"))
        .sort();
      adrFiles.forEach((adrFile) => {
        const adrSlug = adrFile.replace(/\.mdx$/, "");
        adrRefs.push(makeADRRef(projectSlug, adrSlug));
      });
    }
    if (Array.isArray(data.inherits_adrs) && data.inherits_adrs.length > 0) {
      throw new Error(
        `Project ${projectSlug} uses deprecated 'inherits_adrs'. Use inherited ADR stub files in ${projectSlug}/adrs/ with 'inherits_from' instead.`,
      );
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
      productUrl: data.product_url,
      content,
    };

    const projectRelations: ProjectRelations = {
      technologies,
      adrs: adrRefs,
      role: data.role ? normalizeSlug(data.role) : undefined,
      tags: data.tags || [],
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
  entities: Map<ADRRef, ADR>;
  relations: Map<ADRRef, ADRRelations>;
}

export function loadADRs(): ADRLoadResult {
  const entities = new Map<ADRRef, ADR>();
  const relations = new Map<ADRRef, ADRRelations>();
  const inheritedStubRecords: Array<{
    adrRef: ADRRef;
    slug: string;
    projectSlug: ProjectSlug;
    data: Record<string, unknown>;
    content: string;
  }> = [];

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
      const adrRef = makeADRRef(projectSlug, adrSlug);
      const adrPath = path.join(adrsDir, adrFile);
      const fileContent = fs.readFileSync(adrPath, "utf-8");
      const { data, content } = matter(fileContent);

      if (typeof data.inherits_from === "string") {
        inheritedStubRecords.push({
          adrRef,
          slug: adrSlug,
          projectSlug,
          data: data as Record<string, unknown>,
          content,
        });
        return;
      }

      const technologies: TechnologySlug[] = (data.tech_stack || []).map(
        (tech: string) => normalizeSlug(tech),
      );

      const adr: ADR = {
        adrRef,
        slug: adrSlug,
        projectSlug,
        title: data.title as string,
        date: data.date as string,
        status: data.status as ADR["status"],
        inheritsFrom: undefined,
        supersedes: data.supersedes as ADRRef | undefined,
        content,
        readingTime: readingTime(content).text,
      };

      const adrRelations: ADRRelations = {
        project: projectSlug,
        technologies,
      };

      const validation = validateADR(adr);
      if (!validation.success) {
        console.error(
          `Failed to validate ADR ${adrRef}:`,
          validation.schemaErrors,
        );
        throw new Error(`ADR ${adrRef} failed validation`);
      }
      entities.set(adrRef, validation.data);
      relations.set(adrRef, adrRelations);
    });
  });

  for (const record of inheritedStubRecords) {
    const inheritsFrom = record.data.inherits_from as ADRRef;
    const sourceADR = entities.get(inheritsFrom);
    if (!sourceADR) {
      throw new Error(
        `Inherited ADR stub ${record.adrRef} references missing source ADR '${inheritsFrom}'`,
      );
    }
    if (sourceADR.inheritsFrom) {
      throw new Error(
        `Inherited ADR stub ${record.adrRef} cannot inherit from another inherited stub '${inheritsFrom}'`,
      );
    }
    if (
      Array.isArray(record.data.tech_stack) &&
      record.data.tech_stack.length > 0
    ) {
      throw new Error(
        `Inherited ADR stub ${record.adrRef} must not define tech_stack; technologies are derived from '${inheritsFrom}'`,
      );
    }

    const sourceRelations = relations.get(inheritsFrom);
    const adr: ADR = {
      adrRef: record.adrRef,
      slug: record.slug,
      projectSlug: record.projectSlug,
      title: sourceADR.title,
      date: sourceADR.date,
      status: sourceADR.status,
      inheritsFrom,
      supersedes: record.data.supersedes as ADRRef | undefined,
      content: record.content,
      readingTime: readingTime(record.content).text,
    };
    const adrRelations: ADRRelations = {
      project: record.projectSlug,
      technologies: sourceRelations?.technologies ?? [],
    };

    const validation = validateADR(adr);
    if (!validation.success) {
      console.error(
        `Failed to validate inherited ADR stub ${record.adrRef}:`,
        validation.schemaErrors,
      );
      throw new Error(`ADR ${record.adrRef} failed validation`);
    }
    entities.set(record.adrRef, validation.data);
    relations.set(record.adrRef, adrRelations);
  }

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

  for (const exp of definedExperiences) {
    const slug = normalizeSlug(exp.company);
    const technologies: TechnologySlug[] = exp.technologies.map(
      (tech: string) => normalizeSlug(tech),
    );

    const role: JobRole = {
      slug,
      company: exp.company,
      companyUrl: exp.companyUrl,
      logoPath: exp.logoPath,
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
  adrs: Map<ADRRef, ADR>;
  projects: Map<ProjectSlug, Project>;
  blogRelations: Map<BlogSlug, BlogRelations>;
  projectRelations: Map<ProjectSlug, ProjectRelations>;
  adrRelations: Map<ADRRef, ADRRelations>;
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
    if (relations.role && !input.roleRelations.has(relations.role)) {
      errors.push({
        type: "missing_reference",
        entity: `BlogPost[${blogSlug}]`,
        field: "role",
        value: relations.role,
        message: `Role '${relations.role}' referenced by blog '${blogSlug}' does not exist`,
      });
    }
  });

  input.projectRelations.forEach((relations, projectSlug) => {
    relations.technologies.forEach((techSlug) => {
      checkTech(techSlug, `Project[${projectSlug}]`, "technologies");
    });
    relations.adrs.forEach((adrRef) => {
      if (!input.adrs.has(adrRef)) {
        errors.push({
          type: "missing_reference",
          entity: `Project[${projectSlug}]`,
          field: "adrs",
          value: adrRef,
          message: `ADR '${adrRef}' referenced by project '${projectSlug}' does not exist`,
        });
      }
    });
    const adrSlugSet = new Set<string>();
    for (const adrRef of relations.adrs) {
      const adr = input.adrs.get(adrRef);
      if (!adr) continue;
      if (adrSlugSet.has(adr.slug)) {
        errors.push({
          type: "invalid_reference",
          entity: `Project[${projectSlug}]`,
          field: "adrs",
          value: adr.slug,
          message: `Duplicate ADR slug '${adr.slug}' in project '${projectSlug}' context (local + inherited ADRs must be unique)`,
        });
      } else {
        adrSlugSet.add(adr.slug);
      }
    }
    if (relations.role && !input.roleRelations.has(relations.role)) {
      errors.push({
        type: "missing_reference",
        entity: `Project[${projectSlug}]`,
        field: "role",
        value: relations.role,
        message: `Role '${relations.role}' referenced by project '${projectSlug}' does not exist`,
      });
    }
  });

  input.adrRelations.forEach((relations, adrRef) => {
    if (!input.projects.has(relations.project)) {
      errors.push({
        type: "missing_reference",
        entity: `ADR[${adrRef}]`,
        field: "project",
        value: relations.project,
        message: `Project '${relations.project}' referenced by ADR '${adrRef}' does not exist`,
      });
    }
    relations.technologies.forEach((techSlug) => {
      checkTech(techSlug, `ADR[${adrRef}]`, "technologies");
    });
    const adr = input.adrs.get(adrRef);
    if (adr?.inheritsFrom && !input.adrs.has(adr.inheritsFrom)) {
      errors.push({
        type: "missing_reference",
        entity: `ADR[${adrRef}]`,
        field: "inheritsFrom",
        value: adr.inheritsFrom,
        message: `ADR '${adr.inheritsFrom}' referenced by inheritsFrom does not exist`,
      });
    }
    if (adr?.inheritsFrom && input.adrs.get(adr.inheritsFrom)?.inheritsFrom) {
      errors.push({
        type: "invalid_reference",
        entity: `ADR[${adrRef}]`,
        field: "inheritsFrom",
        value: adr.inheritsFrom,
        message: `ADR '${adrRef}' cannot inherit from inherited ADR '${adr.inheritsFrom}'`,
      });
    }
    if (adr?.supersedes && !input.adrs.has(adr.supersedes)) {
      errors.push({
        type: "missing_reference",
        entity: `ADR[${adrRef}]`,
        field: "supersedes",
        value: adr.supersedes,
        message: `ADR '${adr.supersedes}' referenced by supersedes does not exist`,
      });
    }
    if (adr?.supersedes) {
      const allowedTargets = input.projectRelations.get(
        relations.project,
      )?.adrs;
      if (!allowedTargets?.includes(adr.supersedes)) {
        errors.push({
          type: "invalid_reference",
          entity: `ADR[${adrRef}]`,
          field: "supersedes",
          value: adr.supersedes,
          message: `ADR '${adrRef}' cannot supersede '${adr.supersedes}' because it is not local or inherited in project '${relations.project}'`,
        });
      }
    }
    if (adr?.supersedes === adrRef) {
      errors.push({
        type: "circular_reference",
        entity: `ADR[${adrRef}]`,
        field: "supersedes",
        value: adrRef,
        message: `ADR '${adrRef}' cannot supersede itself`,
      });
    }
  });

  input.adrs.forEach((adr, startRef) => {
    const seen = new Set<ADRRef>([startRef]);
    let current = adr.supersedes;
    while (current) {
      if (seen.has(current)) {
        errors.push({
          type: "circular_reference",
          entity: `ADR[${startRef}]`,
          field: "supersedes",
          value: current,
          message: `Circular supersedes chain detected starting at '${startRef}'`,
        });
        break;
      }
      seen.add(current);
      current = input.adrs.get(current)?.supersedes;
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
  adrs: Map<ADRRef, ADR>;
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
    if (projectRels.role) {
      relations.projectRole.set(slug, projectRels.role);
    }
    relations.projectTags.set(slug, projectRels.tags);
  }

  for (const [slug, blogRels] of loaders.blogs.relations) {
    relations.blogTechnologies.set(slug, blogRels.technologies);
    relations.blogTags.set(slug, blogRels.tags);
    if (blogRels.role) {
      relations.blogRole.set(slug, blogRels.role);
    }
  }

  for (const [adrRef, adrRels] of loaders.adrs.relations) {
    relations.adrTechnologies.set(adrRef, adrRels.technologies);
    relations.adrProject.set(adrRef, adrRels.project);
  }

  for (const [adrRef, adr] of loaders.adrs.entities) {
    if (adr.supersedes) {
      relations.adrSupersededBy.set(adrRef, adr.supersedes);
    }
    if (adr.inheritsFrom) {
      relations.adrInheritsFrom.set(adrRef, adr.inheritsFrom);
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
