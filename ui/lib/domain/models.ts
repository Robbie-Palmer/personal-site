import { z } from "zod";

// ============================================================================
// Slug Types (for type safety and referential integrity)
// ============================================================================

export const TechnologySlugSchema = z.string().min(1);
export const BlogSlugSchema = z.string().min(1);
export const ADRSlugSchema = z.string().min(1);
export const ProjectSlugSchema = z.string().min(1);
export const RoleSlugSchema = z.string().min(1);

export type TechnologySlug = z.infer<typeof TechnologySlugSchema>;
export type BlogSlug = z.infer<typeof BlogSlugSchema>;
export type ADRSlug = z.infer<typeof ADRSlugSchema>;
export type ProjectSlug = z.infer<typeof ProjectSlugSchema>;
export type RoleSlug = z.infer<typeof RoleSlugSchema>;

// ============================================================================
// Technology Domain Model
// ============================================================================

export const TechnologySchema = z.object({
  slug: TechnologySlugSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  website: z.string().url().optional(),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  iconSlug: z.string().optional(),

  relations: z.object({
    blogs: z.array(BlogSlugSchema).default([]),
    adrs: z.array(ADRSlugSchema).default([]),
    projects: z.array(ProjectSlugSchema).default([]),
    roles: z.array(RoleSlugSchema).default([]),
  }).default({
    blogs: [],
    adrs: [],
    projects: [],
    roles: [],
  }),
});

export type Technology = z.infer<typeof TechnologySchema>;

// ============================================================================
// BlogPost Domain Model
// ============================================================================

export const BlogPostSchema = z.object({
  slug: BlogSlugSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tags: z.array(z.string()).default([]),
  canonicalUrl: z.string().url().optional(),
  content: z.string(),
  readingTime: z.string(),
  image: z.string().regex(/^blog\/[a-z0-9_-]+-\d{4}-\d{2}-\d{2}$/),
  imageAlt: z.string().min(1),

  relations: z.object({
    technologies: z.array(TechnologySlugSchema).default([]),
  }).default({
    technologies: [],
  }),
});

export type BlogPost = z.infer<typeof BlogPostSchema>;

// ============================================================================
// ADR (Architecture Decision Record) Domain Model
// ============================================================================

export const ADRStatusSchema = z.enum(["Accepted", "Rejected", "Deprecated", "Proposed"]);
export type ADRStatus = z.infer<typeof ADRStatusSchema>;

export const ADRSchema = z.object({
  slug: ADRSlugSchema,
  title: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format (ISO date)
  status: ADRStatusSchema,
  supersededBy: z.string().optional(), // Reference to another ADR slug
  content: z.string(),
  readingTime: z.string(),

  relations: z.object({
    project: ProjectSlugSchema,
    technologies: z.array(TechnologySlugSchema).default([]),
  }),
});

export type ADR = z.infer<typeof ADRSchema>;

// ============================================================================
// Project Domain Model
// ============================================================================

export const ProjectStatusSchema = z.enum(["idea", "in_progress", "live", "archived"]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const ProjectSchema = z.object({
  slug: ProjectSlugSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: ProjectStatusSchema,
  repoUrl: z.string().url().optional(),
  demoUrl: z.string().url().optional(),
  content: z.string(),

  relations: z.object({
    technologies: z.array(TechnologySlugSchema).min(1), // At least one tech required
    adrs: z.array(ADRSlugSchema).default([]),
  }),
});

export type Project = z.infer<typeof ProjectSchema>;

// ============================================================================
// JobRole Domain Model
// ============================================================================

export const JobRoleSchema = z.object({
  slug: RoleSlugSchema,
  company: z.string().min(1),
  companyUrl: z.string().url(),
  logoPath: z.string().min(1),
  title: z.string().min(1),
  location: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM format
  endDate: z.string().regex(/^\d{4}-\d{2}$/).optional(), // undefined for current role
  description: z.string().min(1),
  responsibilities: z.array(z.string()).min(1),

  relations: z.object({
    technologies: z.array(TechnologySlugSchema).default([]),
  }).default({
    technologies: [],
  }),
});

export type JobRole = z.infer<typeof JobRoleSchema>;

// ============================================================================
// Helper Types for Validation
// ============================================================================

export type ValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: z.ZodError;
    };

export interface ReferentialIntegrityError {
  type: "missing_reference" | "invalid_reference" | "circular_reference";
  entity: string;
  field: string;
  value: string;
  message: string;
}

export type DomainValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      schemaErrors?: z.ZodError;
      referentialErrors?: ReferentialIntegrityError[];
    };
