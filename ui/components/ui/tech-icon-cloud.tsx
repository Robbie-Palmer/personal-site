"use client";

import { TechIcon } from "@/lib/tech-icons";
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
  // Create weighted icon array (repeat icons based on weight)
  const weightedIcons = technologies.flatMap((tech) => {
    const weight = Math.max(1, Math.min(3, tech.weight || 1));
    const iconElement = (
      <div
        key={tech.slug || tech.name}
        className="flex items-center justify-center"
        style={{
          width: "100px",
          height: "100px",
          color: tech.brandColor || "currentColor",
        }}
      >
        <TechIcon name={tech.name} className="w-16 h-16" />
      </div>
    );

    // Repeat based on weight (1x, 2x, or 3x)
    return Array(Math.round(weight)).fill(iconElement);
  });

  const handleIconClick = (index: number) => {
    const tech = technologies[index];
    if (!tech) return;

    // Call custom handler if provided
    if (onIconClick) {
      onIconClick(tech, index);
    }

    // Navigate if enabled and URL exists
    if (enableNavigation && tech.url) {
      if (tech.url.startsWith("http")) {
        window.open(tech.url, "_blank", "noopener,noreferrer");
      } else {
        router.push(tech.url);
      }
    }
  };

  const handleIconHover = (index: number | null) => {
    if (index === null) {
      setHoveredTech(null);
    } else {
      const tech = technologies[index];
      setHoveredTech(tech?.name || null);
    }
  };

  return (
    <div className={className}>
      <IconCloud
        icons={weightedIcons}
        size={size}
        onIconClick={handleIconClick}
        onIconHover={handleIconHover}
      />
      {hoveredTech && (
        <div className="mt-4 text-center text-sm text-muted-foreground">
          {hoveredTech}
        </div>
      )}
    </div>
  );
}
