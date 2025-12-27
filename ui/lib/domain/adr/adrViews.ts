import type {
  TechnologyBadgeView,
  TechnologyLabelView,
} from "../technology/technologyViews";
import type { ADR, ADRStatus } from "./adr";

export type ADRCardView = {
  slug: string;
  title: string;
  date: string;
  status: ADRStatus;
  supersededBy?: string;
  readingTime: string;
  projectSlug: string;
  technologies: TechnologyBadgeView[];
};

export type ADRDetailView = {
  slug: string;
  title: string;
  date: string;
  status: ADRStatus;
  supersededBy?: string;
  content: string;
  readingTime: string;
  projectSlug: string;
  technologies: TechnologyLabelView[];
};

export type ADRListItemView = {
  slug: string;
  title: string;
  status: ADRStatus;
};

export function toADRCardView(
  adr: ADR,
  technologies: TechnologyBadgeView[],
): ADRCardView {
  return {
    slug: adr.slug,
    title: adr.title,
    date: adr.date,
    status: adr.status,
    supersededBy: adr.supersededBy,
    readingTime: adr.readingTime,
    projectSlug: adr.relations.project,
    technologies,
  };
}

export function toADRDetailView(
  adr: ADR,
  technologies: TechnologyLabelView[],
): ADRDetailView {
  return {
    slug: adr.slug,
    title: adr.title,
    date: adr.date,
    status: adr.status,
    supersededBy: adr.supersededBy,
    content: adr.content,
    readingTime: adr.readingTime,
    projectSlug: adr.relations.project,
    technologies,
  };
}

export function toADRListItemView(adr: ADR): ADRListItemView {
  return {
    slug: adr.slug,
    title: adr.title,
    status: adr.status,
  };
}
