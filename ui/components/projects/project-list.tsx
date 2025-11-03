"use client";

import { ExternalLink, Github } from "lucide-react";
import Link from "next/link";
import { ContentList } from "@/components/content/content-list";
import { Badge } from "@/components/ui/badge";
import type { Project } from "@/lib/projects";
import { formatDate } from "@/lib/date";

interface ProjectListProps {
  projects: Project[];
}

export function ProjectList({ projects }: ProjectListProps) {
  return (
    <ContentList
      items={projects}
      contentType="projects"
      displayName="Projects"
      searchKeys={[
        { name: "title", weight: 3 },
        { name: "description", weight: 2 },
        { name: "tags", weight: 2 },
        { name: "technologies", weight: 2 },
        { name: "content", weight: 1 },
      ]}
      renderCardContent={(project) =>
        (project.company || project.role) && (
          <p className="text-sm text-muted-foreground">
            {project.role}
            {project.role && project.company && " at "}
            {project.company}
          </p>
        )
      }
      renderCardFooter={(project) => (
        <>
          {project.technologies && project.technologies.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {project.technologies.map((tech) => (
                <Badge key={tech} variant="outline">
                  {tech}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mb-3">
            {project.tags.map((tag) => (
              <Link
                key={tag}
                href={`/projects?tag=${encodeURIComponent(tag)}`}
              >
                <Badge variant="secondary">{tag}</Badge>
              </Link>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              <time>{formatDate(project.date)}</time>
              <span className="mx-2">·</span>
              <span>{project.readingTime}</span>
            </div>
            <div className="flex gap-2">
              {project.githubUrl && (
                <a
                  href={project.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                  aria-label="View source on GitHub"
                >
                  <Github className="h-4 w-4" />
                </a>
              )}
              {project.demoUrl && (
                <a
                  href={project.demoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                  aria-label="View live demo"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </>
      )}
    />
  );
}
