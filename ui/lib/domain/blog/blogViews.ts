import type { TechnologyBadgeView } from "../technology/technologyViews";
import type { BlogPost } from "./blogPost";

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
): BlogCardView {
  return {
    slug: blog.slug,
    title: blog.title,
    description: blog.description,
    date: blog.date,
    updated: blog.updated,
    tags: blog.tags,
    image: blog.image,
    imageAlt: blog.imageAlt,
    readingTime: blog.readingTime,
    technologies,
  };
}

export function toBlogDetailView(
  blog: BlogPost,
  technologies: TechnologyBadgeView[],
): BlogDetailView {
  return {
    slug: blog.slug,
    title: blog.title,
    description: blog.description,
    date: blog.date,
    updated: blog.updated,
    tags: blog.tags,
    canonicalUrl: blog.canonicalUrl,
    content: blog.content,
    readingTime: blog.readingTime,
    image: blog.image,
    imageAlt: blog.imageAlt,
    technologies,
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
