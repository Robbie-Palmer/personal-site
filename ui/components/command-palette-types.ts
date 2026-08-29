import type { ReactNode } from "react";

export interface FilterOption {
  value: string;
  label: string;
  icon?: ReactNode;
  group: string;
  paramName: string;
}

export interface PaletteTechnology {
  slug: string;
  name: string;
  iconSlug?: string;
  hasIcon: boolean;
}
