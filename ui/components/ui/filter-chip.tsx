"use client";

import type { VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import type * as React from "react";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/generic/styles";

interface FilterChipProps
  extends Omit<React.ComponentProps<"span">, "onClick">,
    VariantProps<typeof badgeVariants> {
  onRemove: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}

export function FilterChip({
  onRemove,
  icon,
  children,
  disabled = false,
  variant = "secondary",
  className,
  ...props
}: FilterChipProps) {
  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      onRemove();
    }
  };

  return (
    <Badge
      variant={variant}
      className={cn(
        "flex items-center gap-1.5 pr-1",
        disabled && "opacity-50",
        className,
      )}
      {...props}
    >
      {icon && <span className="shrink-0 [&>svg]:size-3">{icon}</span>}
      <span className="truncate">{children}</span>
      <button
        type="button"
        onClick={handleRemove}
        disabled={disabled}
        className={cn(
          "rounded-full p-0.5 transition-colors",
          "hover:bg-background/50 focus-visible:bg-background/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "cursor-not-allowed",
        )}
        aria-label={`Remove ${children} filter`}
      >
        <X className="size-3" />
      </button>
    </Badge>
  );
}
