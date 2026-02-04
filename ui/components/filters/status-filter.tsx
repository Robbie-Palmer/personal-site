"use client";

import { Circle } from "lucide-react";
import {
  MultiSelect,
  type MultiSelectOption,
} from "@/components/ui/multi-select";
import { ADR_STATUS_CONFIG, ADR_STATUSES } from "@/lib/domain/adr/adr";
import {
  PROJECT_STATUS_CONFIG,
  PROJECT_STATUSES,
} from "@/lib/domain/project/project";

type StatusType = "project" | "adr";

interface StatusFilterProps<T extends StatusType> {
  type: T;
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "default";
}

export function StatusFilter<T extends StatusType>({
  type,
  value,
  onChange,
  label = "Status",
  placeholder = "All statuses",
  className,
  disabled = false,
  size = "default",
}: StatusFilterProps<T>) {
  const options: MultiSelectOption[] =
    type === "project"
      ? PROJECT_STATUSES.map((status) => {
          const statusConfig = PROJECT_STATUS_CONFIG[status];
          return {
            value: status,
            label: statusConfig.label,
            icon: (
              <Circle className={`size-2 fill-current ${statusConfig.color}`} />
            ),
          };
        })
      : ADR_STATUSES.map((status) => {
          const statusConfig = ADR_STATUS_CONFIG[status];
          return {
            value: status,
            label: statusConfig.label,
            icon: (
              <Circle className={`size-2 fill-current ${statusConfig.color}`} />
            ),
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
