"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { RoleListItemView } from "@/lib/domain/role/roleViews";
import { cn } from "@/lib/generic/styles";

interface ProjectRoleBadgeProps {
  role: RoleListItemView;
  className?: string;
  interactive?: boolean;
  active?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export function ProjectRoleBadge({
  role,
  className,
  interactive: interactiveProp,
  active,
  onClick,
}: ProjectRoleBadgeProps) {
  const badge = (
    <Badge
      variant={active ? "default" : "secondary"}
      interactive={interactiveProp ?? true}
      active={active}
      className={cn("bg-muted-foreground/10 cursor-pointer", className)}
      onClick={onClick}
    >
      {role.company}
    </Badge>
  );

  // When no onClick is provided, link to the experience page
  if (!onClick) {
    return (
      <Link
        href={`/experience#${role.slug}`}
        onClick={(e) => e.stopPropagation()}
        aria-label={`View experience at ${role.company}`}
      >
        {badge}
      </Link>
    );
  }

  return badge;
}
