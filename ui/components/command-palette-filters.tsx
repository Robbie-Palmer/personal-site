"use client";

import { FileText, Tag } from "lucide-react";
import type { FilterOption } from "@/components/command-palette";
import { hasTechIcon, TechIcon } from "@/lib/api/tech-icons";

export function createTechFilterOptions(
  technologies: Array<{ slug: string; name: string; iconSlug?: string }>,
): FilterOption[] {
  return technologies.map((tech) => ({
    value: tech.slug,
    label: tech.name,
    icon: hasTechIcon(tech.name, tech.iconSlug) ? (
      <TechIcon name={tech.name} iconSlug={tech.iconSlug} className="size-3" />
    ) : undefined,
    group: "Technology",
    paramName: "tech",
  }));
}

export function createTagFilterOptions(tags: string[]): FilterOption[] {
  return tags.map((tag) => ({
    value: tag,
    label: tag,
    icon: <Tag className="size-3" />,
    group: "Tag",
    paramName: "tags",
  }));
}

export function createStatusFilterOptions(
  statuses: Array<{ value: string; label: string }>,
  paramName = "status",
): FilterOption[] {
  return statuses.map((status) => ({
    value: status.value,
    label: status.label,
    icon: <FileText className="size-3" />,
    group: "Status",
    paramName,
  }));
}

export function createRoleFilterOptions(
  roles: Array<{ slug: string; company: string; logoPath: string }>,
): FilterOption[] {
  return roles.map((role) => ({
    value: role.slug,
    label: role.company,
    icon: (
      // biome-ignore lint/performance/noImgElement: Tiny local logos do not benefit from Next image optimisation.
      <img
        src={role.logoPath}
        alt={`${role.company} logo`}
        width={12}
        height={12}
        className="size-3 object-contain"
      />
    ),
    group: "Role",
    paramName: "role",
  }));
}
