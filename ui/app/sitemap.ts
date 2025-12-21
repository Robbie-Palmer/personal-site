import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { getAllProjects } from "@/lib/projects";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();
  const projects = getAllProjects();

  const blogPosts = posts.map((post) => ({
    url: `${siteConfig.url}/blog/${post.slug}`,
    lastModified: post.updated || post.date,
    priority: 0.9,
  }));

  const projectPages = projects.map((project) => ({
    url: `${siteConfig.url}/projects/${project.slug}`,
    lastModified: project.updated || project.date,
    priority: 0.8,
  }));

  const adrPages = projects.flatMap((project) =>
    project.adrs.map((adr) => ({
      url: `${siteConfig.url}/projects/${project.slug}/adrs/${adr.slug}`,
      lastModified: adr.date,
      priority: 0.8,
    })),
  );

  const latestPostDate = posts.reduce((latest, post) => {
    const postDate = new Date(post.updated || post.date);
    return postDate > latest ? postDate : latest;
  }, new Date(0));

  const latestProjectDate = projects.reduce((latest, project) => {
    const projectDate = new Date(project.updated || project.date);
    return projectDate > latest ? projectDate : latest;
  }, new Date(0));

  return [
    {
      url: siteConfig.url,
      lastModified: new Date().toISOString(),
      priority: 1,
    },
    {
      url: `${siteConfig.url}/blog`,
      lastModified: latestPostDate.toISOString(),
      priority: 0.7,
    },
    {
      url: `${siteConfig.url}/experience`,
      lastModified: new Date().toISOString(),
      priority: 0.7,
    },
    {
      url: `${siteConfig.url}/projects`,
      lastModified: latestProjectDate.toISOString(),
      priority: 0.7,
    },
    ...blogPosts,
    ...projectPages,
    ...adrPages,
  ];
}
