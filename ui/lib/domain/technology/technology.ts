import { z } from "zod";

export const TechnologySlugSchema = z.string().min(1);
export type TechnologySlug = z.infer<typeof TechnologySlugSchema>;

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
      blogs: z.array(z.string()).default([]),
      adrs: z.array(z.string()).default([]),
      projects: z.array(z.string()).default([]),
      roles: z.array(z.string()).default([]),
    })
    .default({
      blogs: [],
      adrs: [],
      projects: [],
      roles: [],
    }),
});

export type Technology = z.infer<typeof TechnologySchema>;
