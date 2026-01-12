import { Badge } from "@/components/ui/badge";
import type { ProjectStatus } from "@/lib/api/projects";
import { cn } from "@/lib/generic/styles";

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  idea: "bg-blue-500 hover:bg-blue-600 border-transparent text-white",
  in_progress: "bg-amber-500 hover:bg-amber-600 border-transparent text-white",
  live: "bg-green-500 hover:bg-green-600 border-transparent text-white",
  archived: "bg-red-500 hover:bg-red-600 border-transparent text-white",
  completed: "bg-purple-500 hover:bg-purple-600 border-transparent text-white",
};

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  idea: "Idea",
  in_progress: "In Progress",
  live: "Live",
  archived: "Archived",
  completed: "Completed",
};

export function ProjectStatusBadge({
  status,
  className,
}: ProjectStatusBadgeProps) {
  return (
    <Badge className={cn(STATUS_COLORS[status], className)}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
