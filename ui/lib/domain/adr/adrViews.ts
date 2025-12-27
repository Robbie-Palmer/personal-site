import type { ADR, ADRStatus } from "./ADR";
import type {
  TechnologyLabelView,
  TechnologyBadgeView,
} from "../technology/technologyViews";

/**
 * View types for ADR (Architecture Decision Record)
 * These are the ONLY types that UI components should use
 */

/**
 * Card view - for ADR listings
 * Use for: ADR cards, ADR lists within projects
 */
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

/**
 * Detail view - full ADR information
 * Use for: ADR detail pages
 */
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

/**
 * List item view - minimal info for simple lists
 * Use for: navigation, related ADRs, TOC
 */
export type ADRListItemView = {
  slug: string;
  title: string;
  status: ADRStatus;
};

/**
 * Transformers - pure functions to convert domain models to views
 */

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
