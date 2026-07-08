import { getTechIconKey } from "@/lib/api/tech-icons";
import type { TechnologyBadgeView } from "@/lib/domain/technology";

export const ADR_CAROUSEL_VISIBLE_TECH_ICON_LIMIT = 3;

export type ADRCarouselTechIcon = Pick<
  TechnologyBadgeView,
  "slug" | "name" | "iconSlug"
>;

export function getADRCarouselTechIcons(
  technologies: TechnologyBadgeView[] | undefined,
  limit = ADR_CAROUSEL_VISIBLE_TECH_ICON_LIMIT,
) {
  const seenIconKeys = new Set<string>();
  const uniqueIcons: ADRCarouselTechIcon[] = [];

  for (const tech of technologies ?? []) {
    const iconKey = getTechIconKey(tech.name, tech.iconSlug);
    if (!iconKey || seenIconKeys.has(iconKey)) continue;

    seenIconKeys.add(iconKey);
    uniqueIcons.push({
      slug: tech.slug,
      name: tech.name,
      iconSlug: tech.iconSlug,
    });
  }

  const visibleIcons = uniqueIcons.slice(0, limit);

  return {
    visibleIcons,
    hiddenIconCount: Math.max(uniqueIcons.length - visibleIcons.length, 0),
  };
}
