"use client";

import { Circle } from "lucide-react";
import {
  MultiSelect,
  type MultiSelectOption,
} from "@/components/ui/multi-select";
import {
  TECHNOLOGY_TYPE_CONFIG,
  TECHNOLOGY_TYPES,
} from "@/lib/domain/technology/technology";

interface TechnologyTypeFilterProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "default";
}

export function TechnologyTypeFilter({
  value,
  onChange,
  label = "Type",
  placeholder = "All types",
  className,
  disabled = false,
  size = "default",
}: TechnologyTypeFilterProps) {
  const options: MultiSelectOption[] = TECHNOLOGY_TYPES.map((type) => {
    const typeConfig = TECHNOLOGY_TYPE_CONFIG[type];
    return {
      value: type,
      label: typeConfig.label,
      icon: <Circle className={`size-2 fill-current ${typeConfig.color}`} />,
    };
  });

  return (
    <MultiSelect
      options={options}
      value={value}
      onChange={onChange}
      label={label}
      placeholder={placeholder}
      searchable={false}
      className={className}
      disabled={disabled}
      size={size}
    />
  );
}
