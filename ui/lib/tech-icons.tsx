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
  "claudecode",
  "shiki",
  "embla-carousel",
  "fusejs",
  "mise",
  "doppler",
]);

// Map technology names to their slugs for edge cases
const techSlugOverrides: Record<string, string> = {
  "c++": "cplusplus",
  "c#": "csharp",
  tensorrt: "nvidia",
  "t-sql": "tsql",
  "stanford nlp": "stanford",
  "scikit-image": "scikit-image",
  "bitbucket pipelines": "bitbucket",
  tailwind: "tailwindcss",
  ccpm: "claude",
  codeql: "github",
  "embla carousel": "embla-carousel",
  turbopack: "nextdotjs",
  "fuse.js": "fusejs",
};

function getTechSlug(name: string): string {
  const override =
    techSlugOverrides[name] || techSlugOverrides[name.toLowerCase()];
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

const getSimpleIcon = (iconSlug: string): SimpleIcon | null => {
  const iconKey =
    `si${iconSlug.charAt(0).toUpperCase()}${iconSlug.slice(1)}` as keyof typeof SimpleIcons;
  // biome-ignore lint/performance/noDynamicNamespaceImportAccess: Dynamic lookup is necessary for icon mapping
  const icon = SimpleIcons[iconKey];
  if (!icon || typeof icon !== "object" || !("path" in icon)) {
    return null;
  }
  return icon as SimpleIcon;
};

type IconData =
  | { type: "custom"; slug: string }
  | { type: "simple"; icon: SimpleIcon };

function resolveIconData(name: string): IconData | null {
  const slug = getTechSlug(name);
  if (customIcons.has(slug)) {
    return { type: "custom", slug };
  }
  let simpleIcon = getSimpleIcon(slug);
  if (!simpleIcon && name.includes(" ")) {
    const [firstWord] = name.split(" ");
    if (firstWord) {
      simpleIcon = getSimpleIcon(getTechSlug(firstWord));
    }
  }
  if (simpleIcon) {
    return { type: "simple", icon: simpleIcon };
  }
  return null;
}

export function TechIcon({ name, className = "w-3 h-3" }: TechIconProps) {
  const iconData = resolveIconData(name);
  if (!iconData) return null;

  if (iconData.type === "custom") {
    return (
      // biome-ignore lint/performance/noImgElement: SSG site uses Cloudflare Images CDN, not Next.js Image
      <img
        src={`/tech-icons/${iconData.slug}.svg`}
        alt={name}
        className={`${className} brightness-0 dark:invert`}
      />
    );
  }

  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{iconData.icon.title}</title>
      <path d={iconData.icon.path} />
    </svg>
  );
}

export function hasTechIcon(name: string): boolean {
  return resolveIconData(name) !== null;
}

export const TECH_URLS: Record<string, string> = {
  react: "https://react.dev",
  "next.js": "https://nextjs.org",
  "tailwind css": "https://tailwindcss.com",
  pnpm: "https://pnpm.io",
  vitest: "https://vitest.dev",
  "shadcn/ui": "https://ui.shadcn.com",
  typescript: "https://www.typescriptlang.org",
  turbopack: "https://turbo.build/pack",
  "github actions": "https://github.com/features/actions",
  "github secrets":
    "https://docs.github.com/en/actions/security-guides/encrypted-secrets",
  github: "https://github.com",
  terraform: "https://www.terraform.io",
  "cloudflare terraform provider":
    "https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs",
  "cloudflare pages": "https://pages.cloudflare.com",
  renovate: "https://docs.renovatebot.com",
  mdx: "https://mdxjs.com",
  shiki: "https://shiki.style",
  "fuse.js": "https://www.fusejs.io",
  recharts: "https://recharts.org",
  zod: "https://zod.dev",
  "lucide react": "https://lucide.dev",
  mermaid: "https://mermaid.js.org",
  "embla carousel": "https://www.embla-carousel.com",
  coderabbit: "https://coderabbit.ai",
  dependabot: "https://github.com/dependabot",
  "claude code": "https://claude.ai",
  mise: "https://mise.jdx.dev",
  codeql: "https://codeql.github.com",
  "cloudflare dns": "https://www.cloudflare.com/dns",
  "cloudflare images": "https://www.cloudflare.com/products/images",
  "terraform cloud": "https://www.hashicorp.com/products/terraform",
  husky: "https://typicode.github.io/husky",
  "tailwind css typography":
    "https://github.com/tailwindlabs/tailwindcss-typography",
  ccpm: "https://github.com/automazeio/ccpm/",
  shortcut: "https://shortcut.com",
  doppler: "https://www.doppler.com",
};

export function getTechUrl(name: string): string | undefined {
  return TECH_URLS[name.toLowerCase()];
}

export function getTechIconUrl(name: string): string | null {
  const iconData = resolveIconData(name);
  if (!iconData) return null;

  if (iconData.type === "custom") {
    return `/tech-icons/${iconData.slug}.svg`;
  }

  const svg = `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>${iconData.icon.title}</title><path fill="currentColor" d="${iconData.icon.path}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
