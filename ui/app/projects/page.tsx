import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectList } from "@/components/projects/project-list";
import { getAllProjects } from "@/lib/projects";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: siteConfig.projects.title,
  description: siteConfig.projects.description,
  openGraph: {
    title: siteConfig.projects.title,
    description: siteConfig.projects.description,
    url: `${siteConfig.url}/projects`,
    siteName: siteConfig.name,
    type: "website",
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: `${siteConfig.name}'s Projects`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.projects.title,
    description: siteConfig.projects.description,
    images: [siteConfig.ogImage],
  },
};

export default function ProjectsPage() {
  const allProjects = getAllProjects();

  return (
    <Suspense fallback={<ProjectListFallback />}>
      <ProjectList projects={allProjects} />
    </Suspense>
  );
}

function ProjectListFallback() {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Projects</h1>
      <p className="text-muted-foreground">Loading projects...</p>
    </div>
  );
}
