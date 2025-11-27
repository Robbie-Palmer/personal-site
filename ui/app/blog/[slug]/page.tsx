import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { DebtInvestmentChart } from "@/components/blog/how-to-build-wealth/debt-investment-chart";
import { FinancialIndependenceChart } from "@/components/blog/how-to-build-wealth/financial-independence-chart";
import { LisaComparisonChart } from "@/components/blog/how-to-build-wealth/lisa-comparison-chart";
import { PensionReturnsChart } from "@/components/blog/how-to-build-wealth/pension-returns-chart";
import { Mermaid } from "@/components/mermaid";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getAllPostSlugs, getPostBySlug } from "@/lib/blog";
import { resolveImageUrl } from "@/lib/cloudflare-images";
import { formatDate } from "@/lib/date";
import { siteConfig } from "@/lib/site-config";

export function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata(
  props: PageProps<"/blog/[slug]">,
): Promise<Metadata> {
  const params = await props.params;
  const { slug } = params;
  const validSlugs = getAllPostSlugs();
  if (!validSlugs.includes(slug)) {
    notFound();
  }

  const post = getPostBySlug(slug);
  // Use custom canonical URL if specified, otherwise use production URL
  // Canonical URLs should always point to production, even in preview deployments
  const canonicalUrl = post.canonicalUrl || `${siteConfig.url}/blog/${slug}`;
  // Resolve image to proper URL (handles both CF Images IDs and local paths)
  // Use hero variant (1200w) for OpenGraph - works well for social sharing
  const imageUrl = post.image
    ? resolveImageUrl(post.image, 'hero')
    : siteConfig.ogImage;

  return {
    title: post.title,
    description: post.description,
    authors: [
      { name: siteConfig.author.name, url: siteConfig.author.linkedin },
    ],
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `/blog/${slug}`,
      siteName: siteConfig.name,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.updated || post.date,
      authors: [siteConfig.author.name],
      tags: post.tags,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: post.image ? 675 : 630,
          alt: post.imageAlt || post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [imageUrl],
    },
  };
}

export default async function BlogPostPage(props: PageProps<"/blog/[slug]">) {
  const params = await props.params;
  const { slug } = params;

  const post = getPostBySlug(slug);

  return (
    <article className="container mx-auto px-4 py-12 max-w-4xl">
      <Link
        href="/blog"
        className="text-sm text-muted-foreground hover:text-foreground mb-8 inline-block"
      >
        ← Back to blog
      </Link>

      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
        <p className="text-xl text-muted-foreground mb-4">{post.description}</p>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="text-muted-foreground">
            <time>{formatDate(post.date)}</time>
            <span className="mx-2">·</span>
            <span>{post.readingTime}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link key={tag} href={`/blog?tag=${encodeURIComponent(tag)}`}>
                <Badge variant="secondary">{tag}</Badge>
              </Link>
            ))}
          </div>
        </div>
      </header>

      {post.image && (
        <div className="relative w-full aspect-video mb-8 rounded-lg overflow-hidden bg-muted">
          <Image
            src={resolveImageUrl(post.image, 'hero')}
            alt={post.imageAlt || post.title}
            fill
            priority
            className="object-cover"
          />
        </div>
      )}

      <Separator className="mb-8" />

      <div className="prose prose-zinc dark:prose-invert max-w-none">
        <MDXRemote
          source={post.content}
          components={{
            DebtInvestmentChart,
            PensionReturnsChart,
            LisaComparisonChart,
            FinancialIndependenceChart,
            Mermaid,
            a: ({ href, children, ...props }) => {
              // Check if the link is external (starts with http:// or https://)
              const isExternal =
                href?.startsWith("http://") || href?.startsWith("https://");

              if (isExternal) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    {...props}
                  >
                    {children}
                  </a>
                );
              }

              // For internal links, use Next.js Link component
              return (
                <Link href={href || ""} {...props}>
                  {children}
                </Link>
              );
            },
          }}
          options={{
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
          }}
        />
      </div>
    </article>
  );
}
