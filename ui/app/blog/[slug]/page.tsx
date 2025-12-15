import type { Metadata } from "next";
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
import { getImageSrcSet, getImageUrl } from "@/lib/cloudflare-images";
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
  // OG images use the 'og' variant (1200px, optimized for social media)
  const imageUrl = post.image
    ? getImageUrl(post.image, "og")
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

  // Preprocess MDX to convert Cloudflare Images IDs to URLs
  // Match pattern: {namespace}/{name}-YYYY-MM-DD (e.g., blog/image-2025-12-14)
  const processedContent = post.content.replace(
    /src="([a-z0-9_-]+\/[a-z0-9_-]+-\d{4}-\d{2}-\d{2})"/g,
    (_match, imageId) => {
      const url = getImageUrl(imageId, null, {
        width: 800,
        format: "auto",
      });
      const srcSet = getImageSrcSet(imageId, null, [800, 1200, 1600]);
      return `src="${url}" srcSet="${srcSet}" sizes="(max-width: 896px) 100vw, 896px" loading="lazy"`;
    },
  );

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
          {/* biome-ignore lint/performance/noImgElement: Need native img for srcset control with SSG */}
          <img
            src={getImageUrl(post.image, null, {
              width: 800,
              format: "auto",
            })}
            srcSet={getImageSrcSet(post.image, null, [800, 1200, 1600])}
            alt={post.imageAlt || post.title}
            sizes="(max-width: 896px) 100vw, 896px"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      )}

      <Separator className="mb-8" />

      <div className="prose prose-zinc dark:prose-invert max-w-none">
        <MDXRemote
          source={processedContent}
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
