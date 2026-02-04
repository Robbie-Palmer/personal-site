import { z } from "zod";
import type { ProjectSlug } from "../slugs";
import {
  ADRSlugSchema,
  ProjectSlugSchema,
  RoleSlugSchema,
  TechnologySlugSchema,
} from "../slugs";

export type { ProjectSlug };

export const ProjectStatusSchema = z.enum([
  "idea",
  "in_progress",
  "live",
  "archived",
  "completed",
]);

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const PROJECT_STATUSES = ProjectStatusSchema.options;

export const PROJECT_STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; color: string }
> = {
  idea: { label: "Idea", color: "text-blue-500" },
  in_progress: { label: "In Progress", color: "text-amber-500" },
  live: { label: "Live", color: "text-green-500" },
  archived: { label: "Archived", color: "text-red-500" },
  completed: { label: "Completed", color: "text-purple-500" },
};

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
  productUrl: z.string().url().optional(),
  content: z.string(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const ProjectRelationsSchema = z.object({
  technologies: z.array(TechnologySlugSchema).default([]),
  adrs: z.array(ADRSlugSchema).default([]),
  role: RoleSlugSchema.optional(),
});

export type ProjectRelations = z.infer<typeof ProjectRelationsSchema>;
