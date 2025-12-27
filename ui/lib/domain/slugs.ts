import { z } from "zod";

export const TechnologySlugSchema = z.string().min(1);
export type TechnologySlug = z.infer<typeof TechnologySlugSchema>;

export const BlogSlugSchema = z.string().min(1);
export type BlogSlug = z.infer<typeof BlogSlugSchema>;

export const ADRSlugSchema = z.string().min(1);
export type ADRSlug = z.infer<typeof ADRSlugSchema>;

export const ProjectSlugSchema = z.string().min(1);
export type ProjectSlug = z.infer<typeof ProjectSlugSchema>;

export const RoleSlugSchema = z.string().min(1);
export type RoleSlug = z.infer<typeof RoleSlugSchema>;
