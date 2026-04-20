import type { CanonicalizationMethod } from "../types/canonicalization";

const METHOD_COLORS: Record<CanonicalizationMethod, string> = {
  exact: "bg-green-100 text-green-800",
  fuzzy: "bg-amber-100 text-amber-800",
  none: "bg-red-100 text-red-800",
};

interface MethodBadgeProps {
  method: CanonicalizationMethod;
}

export function MethodBadge({ method }: MethodBadgeProps) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${METHOD_COLORS[method] ?? "bg-gray-100 text-gray-800"}`}
    >
      {method}
    </span>
  );
}
