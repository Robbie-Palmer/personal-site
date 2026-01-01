"use client";

import { getTechIconUrl } from "@/lib/tech-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconCloud } from "./icon-cloud";

export interface TechIconCloudItem {
  name: string;
  slug?: string;
  weight?: number; // Higher weight = larger icon (1-3 recommended)
  brandColor?: string;
  url?: string; // External URL or internal path
}

interface TechIconCloudProps {
  technologies: TechIconCloudItem[];
  size?: number; // Canvas size in pixels
  className?: string;
  onIconClick?: (tech: TechIconCloudItem, index: number) => void;
  enableNavigation?: boolean; // If true, clicking navigates to URL
}

export function TechIconCloud({
  technologies,
  size = 500,
  className,
  onIconClick,
  enableNavigation = false,
}: TechIconCloudProps) {
  const router = useRouter();
  const [hoveredTech, setHoveredTech] = useState<string | null>(null);
  const [centeredTech, setCenteredTech] = useState<{
    name: string;
    url?: string;
  } | null>(null);

  // Create weighted icon array using image URLs and track which tech each icon belongs to
  const imageUrls: string[] = [];
  const indexToTechMap: number[] = [];

  technologies.forEach((tech, techIndex) => {
    const weight = Math.max(1, Math.min(3, tech.weight || 1));
    const iconUrl = getTechIconUrl(tech.name);

    if (!iconUrl) return;

    // Repeat based on weight (1x, 2x, or 3x)
    for (let i = 0; i < Math.round(weight); i++) {
      imageUrls.push(iconUrl);
      indexToTechMap.push(techIndex);
    }
  });

  const handleIconClick = (iconIndex: number, isCentered: boolean) => {
    const techIndex = indexToTechMap[iconIndex];
    if (techIndex === undefined) return;

    const tech = technologies[techIndex];
    if (!tech) return;

    // Call custom handler if provided
    if (onIconClick) {
      onIconClick(tech, techIndex);
    }

    // If centered and navigation is enabled
    if (isCentered && enableNavigation && tech.url) {
      // Check if this is the same tech that was already centered
      if (centeredTech?.name === tech.name) {
        // Second tap - navigate
        if (tech.url.startsWith("http")) {
          window.open(tech.url, "_blank", "noopener,noreferrer");
        } else {
          router.push(tech.url);
        }
        setCenteredTech(null);
      } else {
        // First tap - show prompt
        setCenteredTech({ name: tech.name, url: tech.url });
      }
    } else {
      // Clear centered tech if clicking a non-centered icon
      setCenteredTech(null);
    }
  };

  const handleIconHover = (iconIndex: number | null) => {
    if (iconIndex === null) {
      setHoveredTech(null);
    } else {
      const techIndex = indexToTechMap[iconIndex];
      if (techIndex === undefined) return;

      const tech = technologies[techIndex];
      setHoveredTech(tech?.name || null);
    }
  };

  return (
    <div className={className}>
      <IconCloud
        images={imageUrls}
        size={size}
        onIconClick={handleIconClick}
        onIconHover={handleIconHover}
      />
      <div className="mt-4 text-center min-h-8">
        {centeredTech ? (
          <div className="text-sm">
            <span className="font-medium">{centeredTech.name}</span>
            <br />
            <span className="text-xs text-muted-foreground">
              Tap again to visit website
            </span>
          </div>
        ) : hoveredTech ? (
          <div className="text-sm text-muted-foreground">{hoveredTech}</div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Tap an icon to center it
          </div>
        )}
      </div>
    </div>
  );
}
