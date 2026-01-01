import type { Metadata } from "next";
import { Suspense } from "react";
import { Markdown } from "@/components/markdown";
import { ProjectList } from "@/components/projects/project-list";
import { ProjectTabsSkeleton } from "@/components/projects/project-tabs-skeleton";
import { ProjectsPageTabs } from "@/components/projects/projects-page-tabs";
import { getAllProjects, getBuildingPhilosophy } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Showcase of my technical projects, architectural decisions, and building philosophy.",
};

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

      <Suspense fallback={<ProjectTabsSkeleton />}>
        <ProjectsPageTabs
          projects={<ProjectList projects={projects} />}
          philosophy={
            <Markdown
              source={philosophyContent}
              className="prose prose-zinc dark:prose-invert max-w-none"
            />
          }
        />
      </Suspense>
    </div>
  );
}
