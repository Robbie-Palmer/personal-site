import { z } from "zod";
import { ADRSlugSchema } from "../adr/adr";
import { TechnologySlugSchema } from "../technology/technology";

export const ProjectSlugSchema = z.string().min(1);
export type ProjectSlug = z.infer<typeof ProjectSlugSchema>;

export const ProjectStatusSchema = z.enum([
  "idea",
  "in_progress",
  "live",
  "archived",
]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

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
      adrs: z.array(ADRSlugSchema).default([]),
    })
    .default({
      technologies: [],
      adrs: [],
    }),
});

export type Project = z.infer<typeof ProjectSchema>;
