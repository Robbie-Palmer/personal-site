import { z } from "zod";
import type { TechnologySlug } from "../slugs";
import { TechnologySlugSchema } from "../slugs";

export type { TechnologySlug };

export const TechnologyTypeSchema = z.enum(["language", "platform", "library"]);

export type TechnologyType = z.infer<typeof TechnologyTypeSchema>;

export const TECHNOLOGY_TYPES = TechnologyTypeSchema.options;

export const TECHNOLOGY_TYPE_CONFIG: Record<
  TechnologyType,
  { label: string; color: string }
> = {
  language: {
    label: "Language",
    color: "text-blue-500",
  },
  platform: {
    label: "Platform",
    color: "text-green-500",
  },
  library: {
    label: "Library",
    color: "text-purple-500",
  },
};

// Content definition schema (slug is optional, will be derived from name if not provided)
const TechnologyContentSchema = z.object({
  name: z.string().min(1),
  slug: TechnologySlugSchema.optional(),
  description: z.string().optional(),
  website: z.string().url(),
  iconSlug: z.string().optional(), // Only when icon slug differs from what's derived from name
  type: TechnologyTypeSchema.optional(),
});

export type TechnologyContent = z.infer<typeof TechnologyContentSchema>;

// Runtime Technology type always has a slug
export type Technology = Omit<TechnologyContent, "slug"> & {
  slug: TechnologySlug;
};

export const TechnologySchema = TechnologyContentSchema;
