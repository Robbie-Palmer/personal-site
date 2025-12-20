import { cn } from "@/lib/styles";

export type ADRStatus = "Accepted" | "Rejected" | "Deprecated" | "Proposed";

export function getADRStatusBadgeClasses(status: ADRStatus) {
  return cn(
    "pointer-events-none",
    status === "Accepted" && "bg-green-600 text-white",
    status === "Proposed" && "bg-blue-600 text-white",
    status === "Deprecated" && "bg-amber-600 text-white",
    status === "Rejected" && "bg-red-600 text-white",
  );
}
