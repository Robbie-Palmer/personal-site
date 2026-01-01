import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { getImageSrcSet, getImageUrl } from "@/lib/cloudflare-images";

type MDXComponents = React.ComponentProps<typeof MDXRemote>["components"];

/**
 * Options for the Markdown component
 */
export interface MarkdownOptions {
  /**
   * Whether to preprocess Cloudflare Image IDs to URLs with srcset
   * Converts patterns like {namespace}/{name}-YYYY-MM-DD to full URLs
   * @default false
   */
  preprocessCloudflareImages?: boolean;
}

/**
 * Props for the Markdown component
 */
export interface MarkdownProps {
  /**
   * The markdown/MDX source content to render
   */
  source: string;
  /**
   * Custom MDX components to override default rendering
   * These will be merged with the base components
   */
  components?: MDXComponents;
  /**
   * Additional options for markdown processing
   */
  options?: MarkdownOptions;
  /**
   * Optional className to apply to the wrapper article element
   */
  className?: string;
}

/**
 * Base MDX components providing smart link handling
 * - Internal links (starting with / or #) use Next.js Link
 * - External links open in new tab with security attributes
 */
const baseComponents: MDXComponents = {
  a: ({ href, children, ...props }) => {
    const isInternal = href?.startsWith("/") || href?.startsWith("#");

    if (isInternal) {
      return (
        <Link href={href as string} {...props}>
          {children}
        </Link>
      );
    }

    // External link
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
};

/**
 * Consolidated Markdown component for rendering MDX content
 *
 * Features:
 * - GitHub Flavored Markdown support (tables, task lists, strikethrough, etc.)
 * - Syntax highlighting with dual themes (github-dark/github-light)
 * - Automatic heading IDs and anchor links
 * - Tailwind Typography styling
 * - Smart internal/external link handling
 * - Optional Cloudflare Images preprocessing with responsive srcset
 * - Custom component support (e.g., Mermaid, custom charts)
 *
 * @example
 * ```tsx
 * import { Markdown } from "@/components/markdown";
 * import { Mermaid } from "@/components/mermaid";
 *
 * <Markdown
 *   source={content}
 *   components={{ Mermaid }}
 *   options={{ preprocessCloudflareImages: true }}
 * />
 * ```
 */
export function Markdown({
  source,
  components,
  options = {},
  className,
}: MarkdownProps) {
  const { preprocessCloudflareImages = false } = options;

  // Preprocess MDX to convert Cloudflare Images IDs to URLs with srcset
  // Match pattern: {namespace}/{name}-YYYY-MM-DD (e.g., blog/image-2025-12-14)
  const processedContent = preprocessCloudflareImages
    ? source.replace(
        /src="([a-z0-9_-]+\/[a-z0-9_-]+-\d{4}-\d{2}-\d{2})"/g,
        (_match, imageId) => {
          const url = getImageUrl(imageId, null, {
            width: 800,
            format: "auto",
          });
          const srcSet = getImageSrcSet(imageId, null, [800, 1200, 1600]);
          return `src="${url}" srcSet="${srcSet}" sizes="(max-width: 896px) 100vw, 896px" loading="lazy"`;
        },
      )
    : source;

  // Merge custom components with base components
  const mergedComponents = { ...baseComponents, ...components };

  return (
    <article className={className}>
      <MDXRemote
        source={processedContent}
        components={mergedComponents}
        options={{
          mdxOptions: {
            remarkPlugins: [
              remarkGfm, // GitHub Flavored Markdown: tables, task lists, strikethrough, etc.
            ],
            rehypePlugins: [
              rehypeSlug, // Add IDs to headings
              rehypeAutolinkHeadings, // Add anchor links to headings
              [
                rehypePrettyCode, // Syntax highlighting
                {
                  theme: {
                    dark: "github-dark",
                    light: "github-light",
                  },
                  keepBackground: false, // Use site's background colors
                },
              ],
            ],
          },
        }}
      />
    </article>
  );
}
