import { Rss } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Markdown } from "@/components/markdown";
import { InitiativeOverview } from "@/components/projects/initiative-overview";
import { ProjectList } from "@/components/projects/project-list";
import { ProjectTabsSkeleton } from "@/components/projects/project-tabs-skeleton";
import { ProjectsPageTabs } from "@/components/projects/projects-page-tabs";
import { Button } from "@/components/ui/button";
import { getAllInitiatives } from "@/lib/api/initiatives";
import { getAllProjects, getBuildingPhilosophy } from "@/lib/api/projects";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Showcase of my technical projects, architectural decisions, and building philosophy.",
};

export default async function ProjectsPage() {
  const projects = getAllProjects();
  const initiatives = getAllInitiatives();
  const philosophyContent = getBuildingPhilosophy();

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Projects</h1>
          <p className="text-xl text-muted-foreground">
            A collection of my work, featuring architectural decision records
            (ADRs), source code links, and the building philosophy that guides
            them
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <a
            href="/projects/feed.xml"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Rss className="h-4 w-4" />
            Subscribe
          </a>
        </Button>
      </div>

      <Suspense fallback={<ProjectTabsSkeleton />}>
        <ProjectsPageTabs
          projects={
            <div className="space-y-12">
              <InitiativeOverview initiatives={initiatives} />
              <section id="all-projects" aria-labelledby="all-projects-heading">
                <div className="mb-6 max-w-3xl">
                  <h2
                    id="all-projects-heading"
                    className="text-2xl font-semibold"
                  >
                    All projects
                  </h2>
                  <p className="mt-2 leading-7 text-muted-foreground">
                    Browse the complete collection, including work that does not
                    belong to a larger initiative.
                  </p>
                </div>
                <ProjectList projects={projects} />
              </section>
            </div>
          }
          philosophy={<Markdown source={philosophyContent} />}
        />
      </Suspense>
    </div>
  );
}
