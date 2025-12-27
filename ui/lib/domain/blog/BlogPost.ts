import { z } from "zod";

export const BlogSlugSchema = z.string().min(1);
export type BlogSlug = z.infer<typeof BlogSlugSchema>;

/**
 * BlogPost domain model - internal representation
 * Should not be imported by UI code directly
 */
export const BlogPostSchema = z.object({
  slug: BlogSlugSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updated: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  tags: z.array(z.string()).default([]),
  canonicalUrl: z.string().url().optional(),
  content: z.string(),
  readingTime: z.string(),
  image: z.string().regex(/^blog\/[a-z0-9_-]+-\d{4}-\d{2}-\d{2}$/),
  imageAlt: z.string().min(1),

  relations: z
    .object({
      technologies: z.array(z.string()).default([]),
    })
    .default({
      technologies: [],
    }),
});

export type BlogPost = z.infer<typeof BlogPostSchema>;
