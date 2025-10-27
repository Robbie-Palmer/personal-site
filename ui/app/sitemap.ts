import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();

  const blogPosts = posts.map((post) => ({
    url: `${siteConfig.url}/blog/${post.slug}`,
    lastModified: post.updated || post.date,
    priority: 0.8,
  }));

  return [
    {
      url: siteConfig.url,
      lastModified: new Date().toISOString(),
      priority: 1,
    },
    {
      url: `${siteConfig.url}/blog`,
      lastModified: posts[0]?.date || new Date().toISOString(),
      priority: 0.9,
    },
    {
      url: `${siteConfig.url}/experience`,
      lastModified: new Date().toISOString(),
      priority: 0.7,
    },
    ...blogPosts,
  ];
}
