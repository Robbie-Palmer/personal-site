"use client";

import { ExternalLink, Github, Globe } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Project } from "@/lib/projects";
import { hasTechIcon, TechIcon } from "@/lib/tech-icons";
import { ProjectStatusBadge } from "./project-status-badge";

interface ProjectCardProps {
  project: Project;
  currentTech?: string | null;
}

export function ProjectCard({ project, currentTech }: ProjectCardProps) {
  return (
    <Card className="flex flex-col h-full hover:shadow-lg transition-all hover:border-primary/50 group relative overflow-hidden">
      {/* Clickable Area for the whole card */}
      <Link href={`/projects/${project.slug}`} className="absolute inset-0 z-0">
        <span className="sr-only">View {project.title}</span>
      </Link>

      <CardHeader>
        <div className="flex justify-between items-start gap-4 pointer-events-none">
          <div className="flex flex-col gap-2 pointer-events-auto">
            <div className="flex gap-2">
              <ProjectStatusBadge status={project.status} />
              <Badge variant="secondary" className="bg-muted-foreground/10">
                {project.adrs.length}{" "}
                {project.adrs.length === 1 ? "ADR" : "ADRs"}
              </Badge>
            </div>
            <CardTitle className="text-xl group-hover:text-primary transition-colors">
              <Link
                href={`/projects/${project.slug}`}
                className="hover:underline underline-offset-4"
              >
                {project.title}
              </Link>
            </CardTitle>
          </div>
          <div className="flex items-center gap-2 pointer-events-auto z-10 text-muted-foreground">
            {project.repoUrl && (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
                aria-label="View Source"
              >
                <Github className="w-5 h-5" />
              </a>
            )}
            {project.demoUrl && (
              <a
                href={project.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
                aria-label="Live Demo"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            )}
            {project.productUrl && (
              <a
                href={project.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
                aria-label="Product Page"
              >
                <Globe className="w-5 h-5" />
              </a>
            )}
          </div>
        </div>
        <CardDescription className="line-clamp-3">
          {project.description}
        </CardDescription>
      </CardHeader>

      <div className="flex-grow" />

      <CardFooter className="flex flex-col items-start gap-4">
        <div className="flex flex-wrap gap-2 z-10">
          {project.technologies.slice(0, 5).map((tech) => {
            const isActive = tech.name === currentTech;
            return (
              <Link
                key={tech.name}
                href={
                  isActive
                    ? "/projects"
                    : `/projects?tech=${encodeURIComponent(tech.name)}`
                }
                onClick={(e) => e.stopPropagation()}
              >
                <Badge
                  variant={isActive ? "default" : "secondary"}
                  interactive
                  active={isActive}
                  className="flex items-center gap-1"
                >
                  {hasTechIcon(tech.name) && (
                    <TechIcon name={tech.name} className="w-3 h-3" />
                  )}
                  {tech.name}
                </Badge>
              </Link>
            );
          })}
          {project.technologies.length > 5 && (
            <Badge variant="secondary">
              +{project.technologies.length - 5}
            </Badge>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
