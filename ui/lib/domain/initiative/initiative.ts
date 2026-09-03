import { z } from "zod";
import { InitiativeSlugSchema, ProjectSlugSchema } from "../slugs";

export type { InitiativeSlug } from "../slugs";

export const InitiativeSchema = z.object({
  slug: InitiativeSlugSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  projectContributions: z
    .record(ProjectSlugSchema, z.string().min(1))
    .default({}),
  content: z.string(),
});

export type Initiative = z.infer<typeof InitiativeSchema>;
