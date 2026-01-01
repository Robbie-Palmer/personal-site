"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getTechIconUrl } from "@/lib/tech-icons";
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
    iconIndex: number;
  } | null>(null);

  // Create icon array using image URLs and track weights
  const imageUrls: string[] = [];
  const iconWeights: number[] = [];
  const indexToTechMap: number[] = [];

  technologies.forEach((tech, techIndex) => {
    const weight = Math.max(1, Math.min(3, tech.weight || 1));
    const iconUrl = getTechIconUrl(tech.name);

    if (!iconUrl) return;

    // Add once with its weight (affects size, not quantity)
    imageUrls.push(iconUrl);
    iconWeights.push(weight);
    indexToTechMap.push(techIndex);
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

    // If centered, show the tech info (removed double-tap navigation)
    if (isCentered) {
      setCenteredTech({ name: tech.name, url: tech.url, iconIndex });
    } else {
      // Clear centered tech if clicking a non-centered icon
      setCenteredTech(null);
    }
  };

  const handleCenteredClick = () => {
    if (!centeredTech?.url || !enableNavigation) return;

    if (centeredTech.url.startsWith("http")) {
      window.open(centeredTech.url, "_blank", "noopener,noreferrer");
    } else {
      router.push(centeredTech.url);
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
        iconWeights={iconWeights}
        size={size}
        onIconClick={handleIconClick}
        onIconHover={handleIconHover}
      />
      <div className="mt-4 text-center min-h-8">
        {centeredTech ? (
          <button
            type="button"
            onClick={handleCenteredClick}
            className="text-sm hover:opacity-80 transition-opacity"
          >
            <span className="font-medium">{centeredTech.name}</span>
            <br />
            {centeredTech.url && enableNavigation && (
              <span className="text-xs text-muted-foreground underline">
                Click to visit website
              </span>
            )}
          </button>
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
