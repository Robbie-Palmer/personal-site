import type { TechnologyBadgeView } from "../technology/technologyViews";
import type { BlogPost } from "./blogPost";

export type BlogRoleView = {
  slug: string;
  company: string;
  logoPath: string;
};

type BaseBlogView = {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated?: string;
  tags: string[];
  image: string;
  imageAlt: string;
  readingTime: string;
  technologies: TechnologyBadgeView[];
  role?: BlogRoleView;
};

export type BlogCardView = BaseBlogView;

export type BlogDetailView = BaseBlogView & {
  canonicalUrl?: string;
  content: string;
};

export type BlogListItemView = {
  slug: string;
  title: string;
  date: string;
  readingTime: string;
};

export function toBlogCardView(
  blog: BlogPost,
  technologies: TechnologyBadgeView[],
  tags: string[],
  role?: BlogRoleView,
): BlogCardView {
  return {
    slug: blog.slug,
    title: blog.title,
    description: blog.description,
    date: blog.date,
    updated: blog.updated,
    tags,
    image: blog.image,
    imageAlt: blog.imageAlt,
    readingTime: blog.readingTime,
    technologies,
    role,
  };
}

export function toBlogDetailView(
  blog: BlogPost,
  technologies: TechnologyBadgeView[],
  tags: string[],
  role?: BlogRoleView,
): BlogDetailView {
  return {
    slug: blog.slug,
    title: blog.title,
    description: blog.description,
    date: blog.date,
    updated: blog.updated,
    tags,
    canonicalUrl: blog.canonicalUrl,
    content: blog.content,
    readingTime: blog.readingTime,
    image: blog.image,
    imageAlt: blog.imageAlt,
    technologies,
    role,
  };
}

export function toBlogListItemView(blog: BlogPost): BlogListItemView {
  return {
    slug: blog.slug,
    title: blog.title,
    date: blog.date,
    readingTime: blog.readingTime,
  };
}
