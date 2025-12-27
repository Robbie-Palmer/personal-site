import { z } from "zod";

export const RoleSlugSchema = z.string().min(1);
export type RoleSlug = z.infer<typeof RoleSlugSchema>;

/**
 * JobRole domain model - internal representation
 * Should not be imported by UI code directly
 */
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
      technologies: z.array(z.string()).default([]),
    })
    .default({
      technologies: [],
    }),
});

export type JobRole = z.infer<typeof JobRoleSchema>;
