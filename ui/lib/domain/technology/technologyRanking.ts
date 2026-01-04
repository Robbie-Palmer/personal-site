import type { DomainRepository } from "@/lib/repository";
import { getContentUsingTechnologyByType } from "@/lib/repository";
import type { Technology } from "./technology";
import type { TechnologyBadgeView } from "./technologyViews";

/**
 * Result of enriching a technology badge with ranking metadata
 */
export type EnrichedTechnologyBadge = {
  badge: TechnologyBadgeView;
  description?: string;
  edgeCount: number;
};

/**
 * Technology with connection weight for visualization components (e.g., TechOrbit)
 */
export type WeightedTechnology = {
  name: string;
  slug?: string;
  weight: number;
  url?: string;
};

/**
 * Calculate connection weight for a technology based on knowledge graph edges
 */
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

/**
 * Ranking algorithm that sorts technologies by their knowledge graph connections.
 * Technologies with more connections (projects, blogs, ADRs, roles) rank higher.
 *
 * This algorithm can be swapped out for alternative ranking strategies
 * (e.g., by recent usage, by category, alphabetically, etc.)
 */
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

/**
 * Get all technologies with connection-based weights for visualization components.
 * Uses the same ranking algorithm as rankTechnologiesByConnections.
 */
export function getTechnologiesWithConnectionWeights(
  repository: DomainRepository,
  technologies: Technology[],
): WeightedTechnology[] {
  return technologies.map((tech) => ({
    name: tech.name,
    slug: tech.slug,
    url: tech.website,
    weight: calculateConnectionWeight(repository, tech.slug),
  }));
}

/**
 * Alternative ranking algorithms can be added here:
 *
 * export function rankTechnologiesAlphabetically(...)
 * export function rankTechnologiesByRecency(...)
 * export function rankTechnologiesByCategory(...)
 */
