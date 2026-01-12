import { Badge } from "@/components/ui/badge";
import type { ADR } from "@/lib/api/projects";
import { cn } from "@/lib/generic/styles";

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
      classes = "bg-green-600 text-white hover:bg-green-700 border-transparent";
      break;
    case "Rejected":
      // Red
      variant = "destructive";
      classes = "bg-red-600 text-white hover:bg-red-700 border-transparent";
      break;
    case "Deprecated":
      // Amber
      variant = "secondary";
      classes = "bg-amber-600 text-white hover:bg-amber-700 border-transparent";
      break;
    case "Proposed":
      // Blue
      variant = "secondary";
      classes = "bg-blue-600 text-white hover:bg-blue-700 border-transparent";
      break;
  }

  return (
    <Badge variant={variant} className={cn(classes, className)}>
      {status}
    </Badge>
  );
}
