import { describe, expect, it } from "vitest";
import { getADRCarouselTechIcons } from "@/components/projects/adr-carousel-tech-icons";
import type { TechnologyBadgeView } from "@/lib/domain/technology";

function tech(
  slug: string,
  name: string,
  iconSlug?: string,
): TechnologyBadgeView {
  return {
    slug,
    name,
    iconSlug: iconSlug ?? slug,
    hasIcon: true,
    website: `https://example.com/${slug}`,
  };
}

describe("getADRCarouselTechIcons", () => {
  it("dedupes technologies that render the same icon", () => {
    const { visibleIcons, hiddenIconCount } = getADRCarouselTechIcons([
      tech("cloudflare-workflows", "Cloudflare Workflows", "cloudflare"),
      tech("cloudflare-r2", "Cloudflare R2", "cloudflare"),
      tech("neon", "Neon", "neon"),
    ]);

    expect(visibleIcons.map((item) => item.slug)).toEqual([
      "cloudflare-workflows",
      "neon",
    ]);
    expect(hiddenIconCount).toBe(0);
  });

  it("limits visible icons and reports remaining unique icons", () => {
    const { visibleIcons, hiddenIconCount } = getADRCarouselTechIcons([
      tech("cloudflare-workflows", "Cloudflare Workflows", "cloudflare"),
      tech("cloudflare-r2", "Cloudflare R2", "cloudflare"),
      tech("neon", "Neon", "neon"),
      tech("openrouter", "OpenRouter", "openrouter"),
      tech("terraform", "Terraform", "terraform"),
      tech("posthog", "PostHog", "posthog"),
    ]);

    expect(visibleIcons.map((item) => item.slug)).toEqual([
      "cloudflare-workflows",
      "neon",
      "openrouter",
    ]);
    expect(hiddenIconCount).toBe(2);
  });

  it("drops technologies without renderable icons", () => {
    const { visibleIcons, hiddenIconCount } = getADRCarouselTechIcons([
      tech("unknown", "Internal Unbranded Service", "missing-icon"),
      tech("neon", "Neon", "neon"),
    ]);

    expect(visibleIcons.map((item) => item.slug)).toEqual(["neon"]);
    expect(hiddenIconCount).toBe(0);
  });
});
