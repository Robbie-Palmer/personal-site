import { Rss } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { preload } from "react-dom";
import { BlogList } from "@/components/blog/blog-list";
import { Button } from "@/components/ui/button";
import { CardGridSkeleton } from "@/components/ui/card-grid-skeleton";
import { getAllPosts } from "@/lib/api/blog";
import { siteConfig } from "@/lib/config/site-config";
import { getImageUrl } from "@/lib/integrations/cloudflare-images";

export const metadata: Metadata = {
  title: siteConfig.blog.title,
  description: siteConfig.blog.description,
  openGraph: {
    title: siteConfig.blog.title,
    description: siteConfig.blog.description,
    url: `${siteConfig.url}/blog`,
    siteName: siteConfig.name,
    type: "website",
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: `${siteConfig.name}'s Blog`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.blog.title,
    description: siteConfig.blog.description,
    images: [siteConfig.ogImage],
  },
};

export default function BlogPage() {
  const allPosts = getAllPosts();
  // getAllPosts() already returns posts sorted by date (newest first)
  const firstPost = allPosts[0];

  // Preload LCP image for fastest discovery using React 19's resource hint API
  // This ensures the hint is emitted into the document head
  if (firstPost?.image) {
    preload(
      getImageUrl(firstPost.image, null, {
        width: 400,
        format: "auto",
      }),
      {
        as: "image",
        fetchPriority: "high",
      },
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 min-h-screen max-w-6xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Blog</h1>
          <p className="text-xl text-muted-foreground">
            Thoughts on technology, finance, and whatever else I'm exploring
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/blog/feed.xml" target="_blank" rel="noopener noreferrer">
            <Rss className="h-4 w-4" />
            Subscribe
          </Link>
        </Button>
      </div>

      <Suspense fallback={<CardGridSkeleton />}>
        <BlogList posts={allPosts} />
      </Suspense>
    </div>
  );
}
