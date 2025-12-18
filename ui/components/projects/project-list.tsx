"use client";

import { FolderGit2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FilterableCardGrid } from "@/components/ui/filterable-card-grid";
import type { Project } from "@/lib/projects";
import { hasTechIcon, TechIcon } from "@/lib/tech-icons";
import { ProjectCard } from "./project-card";

interface ProjectListProps {
  projects: Project[];
}

export function ProjectList({ projects }: ProjectListProps) {
  const searchParams = useSearchParams();
  const currentTech = searchParams.get("tech");

  return (
    <FilterableCardGrid
      items={projects}
      getItemKey={(project) => project.slug}
      searchConfig={{
        placeholder: "Search projects...",
        ariaLabel: "Search projects",
        keys: [
          { name: "title", weight: 3 },
          { name: "description", weight: 2 },
          { name: "tech_stack", weight: 2 },
          { name: "content", weight: 1 },
        ],
        threshold: 0.3,
      }}
      filterConfig={{
        paramName: "tech",
        getItemValues: (project) => project.tech_stack,
        icon:
          currentTech && hasTechIcon(currentTech) ? (
            <TechIcon name={currentTech} className="w-4 h-4" />
          ) : null,
        clearUrl: "/projects",
        labelPrefix: "using",
      }}
      sortConfig={{
        getDate: (project) => project.date,
        getUpdated: (project) => project.updated,
      }}
      emptyState={{
        icon: <FolderGit2 className="w-10 h-10 text-muted-foreground/50" />,
        message: "No projects found matching your criteria.",
      }}
      itemName="projects"
      renderCard={(project) => (
        <ProjectCard project={project} currentTech={currentTech} />
      )}
    />
  );
}
