"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { ProjectListItemView } from "@/lib/domain/project/projectViews";
import { cn } from "@/lib/styles";

interface ProjectBadgeProps {
  project: ProjectListItemView;
  className?: string;
}

export function ProjectBadge({ project, className }: ProjectBadgeProps) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      onClick={(e) => e.stopPropagation()}
      aria-label={`View project ${project.title}`}
    >
      <Badge
        variant="secondary"
        interactive
        className={cn("bg-muted-foreground/10", className)}
      >
        {project.title}
      </Badge>
    </Link>
  );
}
