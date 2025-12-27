import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Markdown } from "@/components/projects/markdown";
import { ProjectList } from "@/components/projects/project-list";
import { ProjectsPageTabs } from "@/components/projects/projects-page-tabs";
import { CardGridSkeleton } from "@/components/ui/card-grid-skeleton";
import { getAllProjects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Showcase of my technical projects, architectural decisions, and building philosophy.",
};

function getBuildingPhilosophy(): string {
  const philosophyPath = path.join(
    process.cwd(),
    "content",
    "projects",
    "building-philosophy.mdx",
  );
  const fileContent = fs.readFileSync(philosophyPath, "utf-8");
  const { content } = matter(fileContent);
  return content;
}

export default async function ProjectsPage() {
  const projects = getAllProjects();
  const philosophyContent = getBuildingPhilosophy();

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Projects</h1>
        <p className="text-xl text-muted-foreground">
          A collection of my work, featuring architectural decision records
          (ADRs), source code links, and the building philosophy that guides
          them
        </p>
      </div>

      <Suspense fallback={<CardGridSkeleton />}>
        <ProjectsPageTabs
          projects={<ProjectList projects={projects} />}
          philosophy={<Markdown source={philosophyContent} />}
        />
      </Suspense>
    </div>
  );
}
