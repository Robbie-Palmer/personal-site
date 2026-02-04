"use client";

import {
  MultiSelect,
  type MultiSelectOption,
} from "@/components/ui/multi-select";
import { TechIcon } from "@/lib/api/tech-icons";

interface FilterableTechnology {
  slug: string;
  name: string;
  iconSlug?: string;
}

interface TechnologyFilterProps {
  technologies: FilterableTechnology[];
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "default";
}

export function TechnologyFilter({
  technologies,
  value,
  onChange,
  label = "Tech",
  placeholder = "All technologies",
  className,
  disabled = false,
  size = "default",
}: TechnologyFilterProps) {
  const options: MultiSelectOption[] = technologies.map((tech) => ({
    value: tech.slug,
    label: tech.name,
    icon: (
      <TechIcon name={tech.name} iconSlug={tech.iconSlug} className="size-3" />
    ),
  }));

  return (
    <MultiSelect
      options={options}
      value={value}
      onChange={onChange}
      label={label}
      placeholder={placeholder}
      searchPlaceholder="Search technologies..."
      className={className}
      disabled={disabled}
      size={size}
    />
  );
}
