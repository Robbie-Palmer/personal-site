import { z } from "zod";
import { IdeaSlugSchema } from "../slugs";

export type { IdeaSlug } from "../slugs";

export const IdeaSchema = z.object({
  slug: IdeaSlugSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  sourceUrl: z.url().optional(),
  content: z.string().min(1),
});

export type Idea = z.infer<typeof IdeaSchema>;

export const IdeaRelationsSchema = z.object({
  relatedIdeas: z.array(IdeaSlugSchema).default([]),
});

export type IdeaRelations = z.infer<typeof IdeaRelationsSchema>;
