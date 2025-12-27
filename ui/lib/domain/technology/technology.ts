import { z } from "zod";
import type { TechnologySlug } from "../slugs";
import {
  ADRSlugSchema,
  BlogSlugSchema,
  ProjectSlugSchema,
  RoleSlugSchema,
  TechnologySlugSchema,
} from "../slugs";

export type { TechnologySlug };

export const TechnologySchema = z.object({
  slug: TechnologySlugSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  website: z.string().url().optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
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
