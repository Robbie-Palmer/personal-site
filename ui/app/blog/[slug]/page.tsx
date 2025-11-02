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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getAllPostSlugs, getPostBySlug } from "@/lib/blog";
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
  // Always use production URL for canonical/permanent reference, even in previews
  const url = `${siteConfig.url}/blog/${slug}`;

  return {
    title: post.title,
    description: post.description,
    authors: [
      { name: siteConfig.author.name, url: siteConfig.author.linkedin },
    ],
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      siteName: siteConfig.name,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.updated || post.date,
      authors: [siteConfig.author.name],
      tags: post.tags,
      images: [
        {
          url: siteConfig.ogImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [siteConfig.ogImage],
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

      <Separator className="mb-8" />

      <div className="prose prose-zinc dark:prose-invert max-w-none">
        <MDXRemote
          source={post.content}
          components={{
            DebtInvestmentChart,
            PensionReturnsChart,
            LisaComparisonChart,
            FinancialIndependenceChart,
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
