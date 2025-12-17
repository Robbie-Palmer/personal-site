import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectList } from "@/components/projects/project-list";
import { ProjectListSkeleton } from "@/components/projects/project-list-skeleton";
import { getAllProjects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Showcase of my technical projects, architectural decisions, and experiments.",
};

export default function ProjectsPage() {
  const projects = getAllProjects();

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Projects</h1>
        <p className="text-xl text-muted-foreground">
          A collection of my work, featuring architectural decision records
          (ADRs), source code links, and live demos
        </p>
      </div>

      <Suspense fallback={ProjectListSkeleton()}>
        <ProjectList projects={projects} />
      </Suspense>
    </div>
  );
}
