import { Badge } from "@/components/ui/badge";
import type { ProjectStatus } from "@/lib/api/projects";
import { PROJECT_STATUS_CONFIG } from "@/lib/domain/project/project";
import { cn } from "@/lib/generic/styles";

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

export function ProjectStatusBadge({
  status,
  className,
}: ProjectStatusBadgeProps) {
  return (
    <Badge className={cn(PROJECT_STATUS_CONFIG[status].badgeClass, className)}>
      {PROJECT_STATUS_CONFIG[status].label}
    </Badge>
  );
}
