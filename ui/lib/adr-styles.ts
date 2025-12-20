import { cn } from "@/lib/styles";

export function getADRStatusBadgeClasses(status: string) {
  return cn(
    "pointer-events-none",
    status === "Accepted" && "bg-green-600 text-white",
    status === "Proposed" && "bg-blue-600 text-white",
    status === "Deprecated" && "bg-amber-600 text-white",
  );
}
