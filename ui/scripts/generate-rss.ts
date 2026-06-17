#!/usr/bin/env tsx

/**
 * Writes RSS 2.0 feeds into the static export directory (out/): a combined
 * feed of all dated content, a blog-only feed, and an ADR-only feed.
 */

import fs from "node:fs";
import path from "node:path";
// Import order matters: registers .wasm loading before content imports
import "./lib/register-wasm";
import { Feed } from "feed";
import { getAllPosts } from "@/lib/api/blog";
import { getAllExperience, getExperienceSlug } from "@/lib/api/experience";
import { getAllADRs, getAllProjects } from "@/lib/api/projects";
import { siteConfig } from "@/lib/config/site-config";
import { loadDomainRepository } from "@/lib/domain";

const OUT_DIR = path.join(process.cwd(), "out");
const MAX_ITEMS = 50;

type FeedEntry = {
  title: string;
  url: string;
  description: string;
  date: Date;
  categories: string[];
};

const day = (date: string): Date => new Date(`${date}T00:00:00Z`);
const month = (value: string): Date => new Date(`${value}-01T00:00:00Z`);

function blogEntries(): FeedEntry[] {
  return getAllPosts().map((post) => {
    const updated = Boolean(post.updated && post.updated !== post.date);
    return {
      title: post.title,
      url: `${siteConfig.url}/blog/${post.slug}`,
      description: post.description,
      date: day(post.updated || post.date),
      categories: ["Blog", ...(updated ? ["Updated"] : []), ...post.tags],
    };
  });
}

function projectEntries(): FeedEntry[] {
  return getAllProjects().map((project) => {
    const updated = Boolean(project.updated && project.updated !== project.date);
    return {
      title: project.title,
      url: `${siteConfig.url}/projects/${project.slug}`,
      description: project.description,
      date: day(project.updated || project.date),
      categories: ["Project", ...(updated ? ["Updated"] : []), ...project.tags],
    };
  });
}

function adrEntries(): FeedEntry[] {
  // Inherited ADRs restate a decision recorded elsewhere; keep each once.
  return getAllADRs()
    .filter((adr) => !adr.isInherited)
    .map((adr) => ({
      title: `${adr.projectTitle}: ${adr.title}`,
      url: `${siteConfig.url}/projects/${adr.projectSlug}/adrs/${adr.slug}`,
      description: `Architecture decision record (${adr.status}) for ${adr.projectTitle}.`,
      date: day(adr.date),
      categories: ["ADR", adr.projectTitle],
    }));
}

function roleEntries(): FeedEntry[] {
  return getAllExperience().map((role) => ({
    title: `${role.title} at ${role.company}`,
    url: `${siteConfig.url}/experience#${getExperienceSlug(role)}`,
    description: role.description,
    date: month(role.startDate),
    categories: ["Experience", role.company],
  }));
}

function technologyEntries(): FeedEntry[] {
  const repository = loadDomainRepository();
  return Array.from(repository.technologies.values())
    .filter((tech): tech is typeof tech & { added: string } => Boolean(tech.added))
    .map((tech) => ({
      title: tech.name,
      url: `${siteConfig.url}/technologies/${tech.slug}`,
      description: tech.description ?? tech.name,
      date: day(tech.added),
      categories: ["Technology", ...(tech.type ? [tech.type] : [])],
    }));
}

function buildFeed(
  meta: { title: string; description: string; feedPath: string },
  entries: FeedEntry[],
): string {
  const items = [...entries]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, MAX_ITEMS);

  const feed = new Feed({
    title: meta.title,
    description: meta.description,
    id: siteConfig.url,
    link: siteConfig.url,
    language: "en",
    copyright: `© ${new Date().getFullYear()} ${siteConfig.author.name}`,
    updated: items[0]?.date ?? new Date(),
    feedLinks: { rss: `${siteConfig.url}${meta.feedPath}` },
    author: { name: siteConfig.author.name, link: siteConfig.url },
  });

  for (const entry of items) {
    feed.addItem({
      title: entry.title,
      id: entry.url,
      link: entry.url,
      description: entry.description,
      date: entry.date,
      category: entry.categories.map((name) => ({ name })),
    });
  }

  return feed.rss2();
}

function write(relativePath: string, content: string): void {
  const filePath = path.join(OUT_DIR, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function main(): void {
  if (!fs.existsSync(OUT_DIR)) {
    console.error(
      "out/ directory not found. Run `next build` first (this script runs as part of `pnpm build`).",
    );
    process.exit(1);
  }

  const blog = blogEntries();
  const projects = projectEntries();
  const adrs = adrEntries();
  const combined = [
    ...blog,
    ...projects,
    ...adrs,
    ...roleEntries(),
    ...technologyEntries(),
  ];

  write(
    "feed.xml",
    buildFeed(
      {
        title: siteConfig.name,
        description: `Updates from ${siteConfig.name} — posts, projects, architecture decisions, roles, and technologies.`,
        feedPath: "/feed.xml",
      },
      combined,
    ),
  );
  write(
    "blog/feed.xml",
    buildFeed(
      {
        title: `${siteConfig.name} — ${siteConfig.blog.title}`,
        description: siteConfig.blog.description,
        feedPath: "/blog/feed.xml",
      },
      blog,
    ),
  );
  write(
    "projects/feed.xml",
    buildFeed(
      {
        title: `${siteConfig.name} — Projects & ADRs`,
        description: `New projects and architecture decision records from ${siteConfig.name}.`,
        feedPath: "/projects/feed.xml",
      },
      [...projects, ...adrs],
    ),
  );

  console.log("Generated feed.xml, blog/feed.xml, and projects/feed.xml in out/");
}

main();
