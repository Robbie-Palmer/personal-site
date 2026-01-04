import { z } from "zod";
import type { TechnologySlug } from "../slugs";
import { TechnologySlugSchema } from "../slugs";

export type { TechnologySlug };

// Content definition schema (slug is optional, will be derived from name if not provided)
const TechnologyContentSchema = z.object({
  name: z.string().min(1),
  slug: TechnologySlugSchema.optional(),
  description: z.string().optional(),
  website: z.string().url().optional(),
  iconSlug: z.string().optional(), // Only when icon slug differs from what's derived from name
});

export type TechnologyContent = z.infer<typeof TechnologyContentSchema>;

// Runtime Technology type always has a slug
export type Technology = Omit<TechnologyContent, "slug"> & {
  slug: TechnologySlug;
};

export const TechnologySchema = TechnologyContentSchema;
