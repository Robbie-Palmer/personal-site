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

export const ADR_STATUSES = ADRStatusSchema.options;

export const ADR_STATUS_CONFIG: Record<
  ADRStatus,
  { label: string; color: string; badgeClass: string }
> = {
  Accepted: {
    label: "Accepted",
    color: "text-green-500",
    badgeClass: "bg-green-600 text-white hover:bg-green-700 border-transparent",
  },
  Rejected: {
    label: "Rejected",
    color: "text-red-500",
    badgeClass: "bg-red-600 text-white hover:bg-red-700 border-transparent",
  },
  Deprecated: {
    label: "Deprecated",
    color: "text-amber-600",
    badgeClass: "bg-amber-600 text-white hover:bg-amber-700 border-transparent",
  },
  Proposed: {
    label: "Proposed",
    color: "text-blue-600",
    badgeClass: "bg-blue-600 text-white hover:bg-blue-700 border-transparent",
  },
};

export const ADRSchema = z.object({
  slug: ADRSlugSchema,
  title: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: ADRStatusSchema,
  supersededBy: ADRSlugSchema.optional(),
  content: z.string(),
  readingTime: z.string(),
});

export type ADR = z.infer<typeof ADRSchema>;

export const ADRRelationsSchema = z.object({
  project: ProjectSlugSchema,
  technologies: z.array(TechnologySlugSchema).default([]),
});

export type ADRRelations = z.infer<typeof ADRRelationsSchema>;
