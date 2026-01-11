import type { Metadata } from "next";
import { Suspense } from "react";
import { preload } from "react-dom";
import { BlogList } from "@/components/blog/blog-list";
import { CardGridSkeleton } from "@/components/ui/card-grid-skeleton";
import { getAllPosts } from "@/lib/blog";
import { getImageUrl } from "@/lib/cloudflare-images";
import { siteConfig } from "@/lib/site-config";

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
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Blog</h1>
        <p className="text-xl text-muted-foreground">
          Thoughts on technology, finance, and whatever else I'm exploring
        </p>
      </div>

      <Suspense fallback={<CardGridSkeleton />}>
        <BlogList posts={allPosts} />
      </Suspense>
    </div>
  );
}
