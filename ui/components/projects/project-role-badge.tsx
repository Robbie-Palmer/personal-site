import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { RoleListItemView } from "@/lib/domain/role/roleViews";

interface ProjectRoleBadgeProps {
  role: RoleListItemView;
  className?: string;
}

export function ProjectRoleBadge({ role, className }: ProjectRoleBadgeProps) {
  return (
    <Link
      href={`/experience#${role.slug}`}
      onClick={(e) => e.stopPropagation()}
    >
      <Badge
        variant="secondary"
        interactive
        className={`bg-muted-foreground/10 ${className || ""}`}
      >
        {role.company}
      </Badge>
    </Link>
  );
}
