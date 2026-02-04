"use client";

import { Tag } from "lucide-react";
import { useMemo } from "react";
import {
  MultiSelect,
  type MultiSelectOption,
} from "@/components/ui/multi-select";

interface TagFilterProps {
  tags: string[];
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "default";
}
export function TagFilter({
  tags,
  value,
  onChange,
  label = "Tags",
  placeholder = "All tags",
  className,
  disabled = false,
  size = "default",
}: TagFilterProps) {
  const options: MultiSelectOption[] = useMemo(
    () =>
      tags.map((tag) => ({
        value: tag,
        label: tag,
      })),
    [tags],
  );

  return (
    <MultiSelect
      options={options}
      value={value}
      onChange={onChange}
      label={label}
      placeholder={placeholder}
      icon={<Tag className="size-4" />}
      searchPlaceholder="Search tags..."
      className={className}
      disabled={disabled}
      size={size}
    />
  );
}
