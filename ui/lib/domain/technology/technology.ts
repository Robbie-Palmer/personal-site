import { z } from "zod";
import type { TechnologySlug } from "../slugs";
import { TechnologySlugSchema } from "../slugs";

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
  iconSlug: z.string().optional(), // Only when icon slug differs from normalized name
});

export type Technology = z.infer<typeof TechnologySchema>;
