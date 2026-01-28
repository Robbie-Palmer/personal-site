import type { DomainRepository } from "@/lib/repository";
import { getContentUsingTechnologyByType } from "@/lib/repository";
import type { Technology } from "./technology";
import type { TechnologyBadgeView } from "./technologyViews";

export type EnrichedTechnologyBadge = {
  badge: TechnologyBadgeView;
  description?: string;
  edgeCount: number;
};

export type WeightedTechnology = {
  name: string;
  slug?: string;
  iconSlug?: string;
  weight: number;
  url: string;
};

function calculateConnectionWeight(
  repository: DomainRepository,
  techSlug: string,
): number {
  const usage = getContentUsingTechnologyByType(repository.graph, techSlug);
  return (
    usage.projects.length +
    usage.blogs.length +
    usage.adrs.length +
    usage.roles.length
  );
}

export function rankTechnologiesByConnections(
  repository: DomainRepository,
  badges: TechnologyBadgeView[],
): EnrichedTechnologyBadge[] {
  return badges
    .map((badge) => {
      const tech = repository.technologies.get(badge.slug);
      const edgeCount = calculateConnectionWeight(repository, badge.slug);

      return {
        badge,
        description: tech?.description,
        edgeCount,
      };
    })
    .sort((a, b) => b.edgeCount - a.edgeCount);
}

export function getTechnologiesWithConnectionWeights(
  repository: DomainRepository,
  technologies: Technology[],
): WeightedTechnology[] {
  return technologies.map((tech) => ({
    name: tech.name,
    slug: tech.slug,
    iconSlug: tech.iconSlug,
    url: `/technologies/${tech.slug}`,
    weight: calculateConnectionWeight(repository, tech.slug),
  }));
}
