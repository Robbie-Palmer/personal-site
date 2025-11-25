import type { SimpleIcon } from "simple-icons";
import * as SimpleIcons from "simple-icons";

// Custom SVG icons available in /public/tech-icons/
const customIcons = new Set([
  "aws",
  "java",
  "stanford",
  "neo4j",
  "tsql",
  "csharp",
  "scikit-image",
  "weaviate",
  "openrouter",
]);

// Map technology names to their slugs for edge cases
const techSlugOverrides: Record<string, string> = {
  "C++": "cplusplus",
  "C#": "csharp",
  TensorRT: "nvidia",
  "T-SQL": "tsql",
  "Stanford NLP": "stanford",
  "scikit-image": "scikit-image",
  "Bitbucket Pipelines": "bitbucket",
};

function getTechSlug(name: string): string {
  const override = techSlugOverrides[name];
  if (override) {
    return override;
  }
  // Map name to default naming conventions
  return name
    .toLowerCase()
    .replace(/\./g, "dot")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

interface TechIconProps {
  name: string;
  className?: string;
}

export function TechIcon({ name, className = "w-3 h-3" }: TechIconProps) {
  const slug = getTechSlug(name);
  // Check if we have a custom icon
  if (customIcons.has(slug)) {
    return (
      <img
        src={`/tech-icons/${slug}.svg`}
        alt={name}
        className={`${className} brightness-0 dark:invert`}
      />
    );
  }
  // Fall back to Simple Icons
  const iconKey =
    `si${slug.charAt(0).toUpperCase()}${slug.slice(1)}` as keyof typeof SimpleIcons;
  const icon = SimpleIcons[iconKey];
  if (!icon || typeof icon !== "object" || !("path" in icon)) {
    return null;
  }
  const simpleIcon = icon as SimpleIcon;
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{simpleIcon.title}</title>
      <path d={simpleIcon.path} />
    </svg>
  );
}

export function hasTechIcon(name: string): boolean {
  const slug = getTechSlug(name);
  if (customIcons.has(slug)) {
    return true;
  }
  // Check if it exists in Simple Icons
  const iconKey =
    `si${slug.charAt(0).toUpperCase()}${slug.slice(1)}` as keyof typeof SimpleIcons;
  const icon = SimpleIcons[iconKey];
  return !!icon && typeof icon === "object" && "path" in icon;
}
