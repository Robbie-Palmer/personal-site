import { z } from "zod";
import {
  ADRRelationsSchema,
  ADRStatusSchema,
  ADRSchema as BaseADRSchema,
} from "./adr/adr";
import { ADRRefSchema as CanonicalADRRefSchema } from "./slugs";

export const TechnologySlugSchema = z.string().min(1);
export const BlogSlugSchema = z.string().min(1);
export const ADRSlugSchema = z.string().min(1);
export const ADRRefSchema = CanonicalADRRefSchema;
export const ProjectSlugSchema = z.string().min(1);
export const RoleSlugSchema = z.string().min(1);

export type TechnologySlug = z.infer<typeof TechnologySlugSchema>;
export type BlogSlug = z.infer<typeof BlogSlugSchema>;
export type ADRSlug = z.infer<typeof ADRSlugSchema>;
export type ADRRef = z.infer<typeof ADRRefSchema>;
export type ProjectSlug = z.infer<typeof ProjectSlugSchema>;
export type RoleSlug = z.infer<typeof RoleSlugSchema>;

export const TechnologySchema = z.object({
  name: z.string().min(1),
  slug: TechnologySlugSchema.optional(),
  description: z.string().optional(),
  website: z.string().url().optional(),
  iconSlug: z.string().optional(),

  relations: z
    .object({
      blogs: z.array(BlogSlugSchema).default([]),
      adrs: z.array(ADRSlugSchema).default([]),
      projects: z.array(ProjectSlugSchema).default([]),
      roles: z.array(RoleSlugSchema).default([]),
    })
    .default({
      blogs: [],
      adrs: [],
      projects: [],
      roles: [],
    }),
});

export type Technology = z.infer<typeof TechnologySchema>;

export const BlogPostSchema = z.object({
  slug: BlogSlugSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updated: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  tags: z.array(z.string()).default([]),
  canonicalUrl: z.string().url().optional(),
  content: z.string(),
  readingTime: z.string(),
  image: z.string().regex(/^blog\/[a-z0-9_-]+-\d{4}-\d{2}-\d{2}$/),
  imageAlt: z.string().min(1),

  relations: z
    .object({
      technologies: z.array(TechnologySlugSchema).default([]),
    })
    .default({
      technologies: [],
    }),
});

export type BlogPost = z.infer<typeof BlogPostSchema>;

export { ADRStatusSchema };
export type ADRStatus = z.infer<typeof ADRStatusSchema>;

export const ADRSchema = BaseADRSchema.extend({
  relations: ADRRelationsSchema,
});

export type ADR = z.infer<typeof ADRSchema>;

import { type ProjectStatus, ProjectStatusSchema } from "./project/project";

export { ProjectStatusSchema };
export type { ProjectStatus };

export const ProjectSchema = z.object({
  slug: ProjectSlugSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updated: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  status: ProjectStatusSchema,
  repoUrl: z.string().url().optional(),
  demoUrl: z.string().url().optional(),
  content: z.string(),

  relations: z
    .object({
      technologies: z.array(TechnologySlugSchema).default([]),
      adrs: z.array(ADRRefSchema).default([]),
    })
    .default({
      technologies: [],
      adrs: [],
    }),
});

export type Project = z.infer<typeof ProjectSchema>;

export const JobRoleSchema = z.object({
  slug: RoleSlugSchema,
  company: z.string().min(1),
  companyUrl: z.string().url(),
  logoPath: z.string().min(1),
  title: z.string().min(1),
  location: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}$/),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  description: z.string().min(1),
  responsibilities: z.array(z.string()).min(1),

  relations: z
    .object({
      technologies: z.array(TechnologySlugSchema).default([]),
    })
    .default({
      technologies: [],
    }),
});

export type JobRole = z.infer<typeof JobRoleSchema>;

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
