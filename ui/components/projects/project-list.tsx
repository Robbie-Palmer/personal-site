"use client";

import Fuse from "fuse.js";
import { ArrowDown, ArrowUp, Clock, FolderGit2, Search, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Project } from "@/lib/projects";
import { hasTechIcon, TechIcon } from "@/lib/tech-icons";
import { useSortParam } from "@/lib/use-sort-param";
import { ProjectCard } from "./project-card";

interface ProjectListProps {
  projects: Project[];
}

const SORT_OPTIONS = ["newest", "oldest", "updated"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

export function ProjectList({ projects }: ProjectListProps) {
  const searchParams = useSearchParams();
  const currentTech = searchParams.get("tech");
  const { currentSort, cycleSortOrder } = useSortParam<SortOption>(
    SORT_OPTIONS,
    "newest",
  );
  const [searchQuery, setSearchQuery] = useState("");

  const fuse = useMemo(
    () =>
      new Fuse(projects, {
        keys: [
          { name: "title", weight: 3 },
          { name: "description", weight: 2 },
          { name: "tech_stack", weight: 2 },
          { name: "content", weight: 1 },
        ],
        threshold: 0.3,
        ignoreLocation: true,
      }),
    [projects],
  );

  // Filter projects
  const filteredProjects = useMemo(() => {
    let filtered = searchQuery.trim()
      ? fuse.search(searchQuery).map((result) => result.item)
      : projects;

    if (currentTech) {
      filtered = filtered.filter((project) =>
        project.tech_stack.includes(currentTech),
      );
    }
    return filtered;
  }, [fuse, searchQuery, projects, currentTech]);

  // Apply sorting
  const sortedProjects = useMemo(() => {
    return [...filteredProjects].sort((a, b) => {
      if (currentSort === "oldest") {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (currentSort === "updated") {
        const aDate = new Date(a.updated ?? a.date).getTime();
        const bDate = new Date(b.updated ?? b.date).getTime();
        return bDate - aDate;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [filteredProjects, currentSort]);

  const getSortIcon = () => {
    switch (currentSort) {
      case "oldest":
        return <ArrowUp className="h-4 w-4" />;
      case "updated":
        return <Clock className="h-4 w-4" />;
      default:
        return <ArrowDown className="h-4 w-4" />;
    }
  };

  const getSortLabel = () => {
    switch (currentSort) {
      case "oldest":
        return "Oldest first";
      case "updated":
        return "Recently updated";
      default:
        return "Newest first";
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-baseline gap-4 mb-6">
        {currentTech && (
          <Badge
            variant="secondary"
            className="flex items-center gap-2 text-base px-3 py-1 hover:bg-primary/20 hover:text-primary border border-transparent transition-colors"
          >
            {hasTechIcon(currentTech) && (
              <TechIcon name={currentTech} className="w-4 h-4" />
            )}
            <span>{currentTech}</span>
            <Link
              href="/projects"
              className="rounded-full hover:bg-background/50 p-0.5 ml-1 transition-colors"
              aria-label={`Remove ${currentTech} filter`}
            >
              <X className="h-3 w-3" />
            </Link>
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
            aria-label="Search projects"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={cycleSortOrder}
          title={getSortLabel()}
          aria-label={`Sort: ${getSortLabel()}. Click to change sort order.`}
        >
          {getSortIcon()}
        </Button>
      </div>

      {(searchQuery || currentTech) && sortedProjects.length > 0 && (
        <p className="text-sm text-muted-foreground mb-6">
          Showing {sortedProjects.length} of {projects.length} projects
          {searchQuery && ` matching "${searchQuery}"`}
          {currentTech && ` using ${currentTech}`}
        </p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedProjects.map((project) => (
          <ProjectCard
            key={project.slug}
            project={project}
            currentTech={currentTech}
          />
        ))}
      </div>

      {sortedProjects.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
          <div className="flex flex-col items-center gap-2">
            <FolderGit2 className="w-10 h-10 text-muted-foreground/50" />
            <p>No projects found matching your criteria.</p>
          </div>
        </div>
      )}
    </div>
  );
}
