import { z } from "zod";
import type { ADRSlug } from "../slugs";
import {
  ADRSlugSchema,
  ProjectSlugSchema,
  TechnologySlugSchema,
} from "../slugs";

export type { ADRSlug };

export const ADRStatusSchema = z.enum([
  "Accepted",
  "Rejected",
  "Deprecated",
  "Proposed",
]);
export type ADRStatus = z.infer<typeof ADRStatusSchema>;

export const ADRSchema = z.object({
  slug: ADRSlugSchema,
  title: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: ADRStatusSchema,
  supersededBy: ADRSlugSchema.optional(),
  content: z.string(),
  readingTime: z.string(),

  relations: z.object({
    project: ProjectSlugSchema,
    technologies: z.array(TechnologySlugSchema).default([]),
  }),
});

export type ADR = z.infer<typeof ADRSchema>;
