import { Check } from "lucide-react";

/**
 * The tick-box visual shared by every checkable row in the shopping list.
 * Presentational only (aria-hidden); the interactive element is the parent
 * button/label that owns the checked state.
 */
export function ShoppingCheckbox({
  checked,
  className,
}: Readonly<{
  checked: boolean;
  className?: string;
}>) {
  return (
    <span
      aria-hidden="true"
      className={[
        "h-4 w-4 rounded-[3px] flex-shrink-0 border-2 flex items-center justify-center transition-colors",
        checked
          ? "bg-[var(--terracotta)] border-[var(--terracotta)]"
          : "border-[var(--line-strong)] hover:border-[var(--terracotta)]",
        className ?? "",
      ].join(" ")}
    >
      {checked && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
    </span>
  );
}
