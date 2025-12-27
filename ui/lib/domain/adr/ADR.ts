import { z } from "zod";

export const ADRSlugSchema = z.string().min(1);
export type ADRSlug = z.infer<typeof ADRSlugSchema>;

export const ADRStatusSchema = z.enum([
  "Accepted",
  "Rejected",
  "Deprecated",
  "Proposed",
]);
export type ADRStatus = z.infer<typeof ADRStatusSchema>;

/**
 * ADR (Architecture Decision Record) domain model - internal representation
 * Should not be imported by UI code directly
 */
export const ADRSchema = z.object({
  slug: ADRSlugSchema,
  title: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: ADRStatusSchema,
  supersededBy: z.string().optional(),
  content: z.string(),
  readingTime: z.string(),

  relations: z.object({
    project: z.string(),
    technologies: z.array(z.string()).default([]),
  }),
});

export type ADR = z.infer<typeof ADRSchema>;
