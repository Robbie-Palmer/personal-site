import type { Metadata } from "next";
import { Suspense } from "react";
import { BlogList } from "@/components/blog/blog-list";
import { getAllPosts } from "@/lib/blog";
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

  return (
    <Suspense fallback={<BlogListFallback />}>
      <BlogList posts={allPosts} />
    </Suspense>
  );
}

function BlogListFallback() {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Blog</h1>
      <p className="text-muted-foreground">Loading posts...</p>
    </div>
  );
}
