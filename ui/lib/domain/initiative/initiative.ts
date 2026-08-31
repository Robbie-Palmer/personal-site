import { z } from "zod";
import { InitiativeSlugSchema } from "../slugs";

export type { InitiativeSlug } from "../slugs";

export const InitiativeSchema = z.object({
  slug: InitiativeSlugSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  content: z.string(),
});

export type Initiative = z.infer<typeof InitiativeSchema>;
