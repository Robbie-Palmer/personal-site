import type { Idea } from "./idea";

export type IdeaLinkView = Pick<Idea, "slug" | "title" | "description">;

export function toIdeaLinkView(idea: Idea): IdeaLinkView {
  return {
    slug: idea.slug,
    title: idea.title,
    description: idea.description,
  };
}
