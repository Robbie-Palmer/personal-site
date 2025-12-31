import { z } from "zod";
import type { RoleSlug } from "../slugs";
import { RoleSlugSchema, TechnologySlugSchema } from "../slugs";

export type { RoleSlug };

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
});

export type JobRole = z.infer<typeof JobRoleSchema>;

export const RoleRelationsSchema = z.object({
  technologies: z.array(TechnologySlugSchema).default([]),
});

export type RoleRelations = z.infer<typeof RoleRelationsSchema>;
