import { Badge } from "@/components/ui/badge";
import type { ADR } from "@/lib/projects";
import { cn } from "@/lib/styles";

interface ADRBadgeProps {
  status: ADR["status"];
  className?: string;
}

export function ADRBadge({ status, className }: ADRBadgeProps) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  let classes = "";

  switch (status) {
    case "Accepted":
      // Green
      variant = "default";
      classes =
        "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/40 border-green-200 dark:border-green-800";
      break;
    case "Rejected":
      // Red
      variant = "destructive";
      classes =
        "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/40 border-red-200 dark:border-red-800";
      break;
    case "Deprecated":
      // Gray
      variant = "secondary";
      classes =
        "bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700";
      break;
    case "Proposed":
      // Blue
      variant = "secondary";
      classes =
        "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/40 border-blue-200 dark:border-blue-800";
      break;
  }

  return (
    <Badge variant={variant} className={cn(classes, "border", className)}>
      {status}
    </Badge>
  );
}
