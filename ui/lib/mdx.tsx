import { MDXRemote, type MDXRemoteProps } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { Mermaid } from "@/components/mermaid";

/**
 * Shared MDX options for all content types (blog, projects, etc.)
 */
export const mdxOptions: MDXRemoteProps["options"] = {
  mdxOptions: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      rehypeAutolinkHeadings,
      [
        rehypePrettyCode,
        {
          theme: {
            dark: "github-dark",
            light: "github-light",
          },
          keepBackground: false,
        },
      ],
    ],
  },
};

/**
 * Shared MDX components for all content types
 */
export const mdxComponents: MDXRemoteProps["components"] = {
  Mermaid,
};

/**
 * Render MDX content with shared configuration
 */
export function renderMDX(source: string) {
  return (
    <MDXRemote
      source={source}
      options={mdxOptions}
      components={mdxComponents}
    />
  );
}
