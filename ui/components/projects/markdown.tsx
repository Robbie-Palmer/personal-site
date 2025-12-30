import Image from "next/image";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import { highlight } from "@/lib/shiki";

type MDXComponents = React.ComponentProps<typeof MDXRemote>["components"];

const baseComponents: MDXComponents = {
  h1: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      className="scroll-m-20 text-3xl font-extrabold tracking-tight mt-8 first:mt-0 mb-4"
      {...props}
    />
  ),
  h2: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight first:mt-0 mt-10 mb-4"
      {...props}
    />
  ),
  h3: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      className="scroll-m-20 text-xl font-semibold tracking-tight mt-8 mb-4"
      {...props}
    />
  ),
  p: ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="leading-7 [&:not(:first-child)]:mt-6 mb-4" {...props} />
  ),
  ul: ({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="my-6 ml-6 list-disc [&>li]:mt-2" {...props} />
  ),
  ol: ({ className, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="my-6 ml-6 list-decimal [&>li]:mt-2" {...props} />
  ),
  li: ({ className, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="leading-7" {...props} />
  ),
  blockquote: ({
    className,
    ...props
  }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="mt-6 border-l-2 pl-6 italic text-muted-foreground"
      {...props}
    />
  ),
  a: ({
    className,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const isInternal = href?.startsWith("/") || href?.startsWith("#");
    if (isInternal) {
      return (
        <Link
          href={href as string}
          className="font-medium text-primary underline underline-offset-4"
          {...props}
        />
      );
    }
    return (
      <a
        href={href}
        className="font-medium text-primary underline underline-offset-4"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      />
    );
  },
  code: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <code
      className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold"
      {...props}
    />
  ),
  pre: async ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => {
    const codeElement = children as React.ReactElement<{
      className?: string;
      children: string;
    }>;
    const code = codeElement?.props?.children;

    // Only attempt highlighting if we have a string code content
    if (typeof code === "string") {
      try {
        // Get language from className (format: "language-js")
        const language =
          codeElement.props.className?.replace("language-", "") || "text";

        const html = await highlight(code, language);

        return (
          <div
            className="my-6 rounded-lg overflow-x-auto border bg-muted"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Needed for Shiki highlighting
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } catch (error) {
        console.error("Syntax highlighting failed:", error);
        // Fall through to default pre rendering
      }
    }
    return <pre {...props}>{children}</pre>;
  },
  Image: (props: React.ComponentProps<typeof Image>) => (
    <Image {...props} className="rounded-md border" />
  ),
};

type MarkdownProps = {
  source: string;
  components?: MDXComponents;
};

export function Markdown({ source, components }: MarkdownProps) {
  const mergedComponents = { ...baseComponents, ...components };

  return (
    <article className="prose prose-zinc dark:prose-invert max-w-none">
      <MDXRemote
        source={source}
        components={mergedComponents}
        options={{
          mdxOptions: {
            rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings],
          },
        }}
      />
    </article>
  );
}
