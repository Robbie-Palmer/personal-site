import { z } from "zod";
import type { RecipeSlug } from "../slugs";
import { RecipeSlugSchema } from "../slugs";

export type { RecipeSlug };

export const RecipeSchema = z.object({
  slug: RecipeSlugSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  content: z.string(),
  image: z
    .string()
    .regex(/^recipes\/[a-z0-9_-]+-\d{4}-\d{2}-\d{2}$/)
    .optional(),
  imageAlt: z.string().min(1).optional(),
});

export type Recipe = z.infer<typeof RecipeSchema>;

export const RecipeRelationsSchema = z.object({
  tags: z.array(z.string()).default([]),
});

export type RecipeRelations = z.infer<typeof RecipeRelationsSchema>;
