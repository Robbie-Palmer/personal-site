"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { RoleListItemView } from "@/lib/domain/role/roleViews";
import { cn } from "@/lib/generic/styles";

interface ProjectRoleBadgeProps {
  role: RoleListItemView;
  className?: string;
}

export function ProjectRoleBadge({ role, className }: ProjectRoleBadgeProps) {
  return (
    <Link
      href={`/experience#${role.slug}`}
      onClick={(e) => e.stopPropagation()}
      aria-label={`View experience at ${role.company}`}
    >
      <Badge
        variant="secondary"
        interactive
        className={cn("bg-muted-foreground/10", className)}
      >
        {role.company}
      </Badge>
    </Link>
  );
}
