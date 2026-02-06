"use client";

import { Briefcase } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";
import {
  MultiSelect,
  type MultiSelectOption,
} from "@/components/ui/multi-select";
import { cn } from "@/lib/generic/styles";

interface FilterableRole {
  slug: string;
  company: string;
  logoPath: string;
  title: string;
}

interface RoleFilterProps {
  roles: FilterableRole[];
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "default";
}

export function RoleFilter({
  roles,
  value,
  onChange,
  label = "Role",
  placeholder = "All roles",
  className,
  disabled = false,
  size = "default",
}: RoleFilterProps) {
  const options: MultiSelectOption[] = useMemo(() => {
    return roles.map((role) => ({
      value: role.slug,
      label: `${role.company} (${role.title})`,
      icon: (
        <Image
          src={role.logoPath}
          alt={`${role.company} logo`}
          width={12}
          height={12}
          className="size-3 object-contain"
        />
      ),
    }));
  }, [roles]);

  return (
    <div className={cn("flex items-center", className)}>
      <MultiSelect
        options={options}
        value={value}
        onChange={onChange}
        label={label}
        placeholder={placeholder}
        icon={<Briefcase className="size-4 text-muted-foreground" />}
        disabled={disabled}
        size={size}
        searchable={roles.length > 5}
        searchPlaceholder="Search roles..."
      />
    </div>
  );
}
