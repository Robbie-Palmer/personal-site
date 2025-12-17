"use client";

import { ExternalLink, Github } from "lucide-react";
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
          <CardTitle className="text-xl group-hover:text-primary transition-colors pointer-events-auto">
            <Link
              href={`/projects/${project.slug}`}
              className="hover:underline underline-offset-4"
            >
              {project.title}
            </Link>
          </CardTitle>
          <div className="flex items-center gap-2 pointer-events-auto z-10 text-muted-foreground">
            {project.repo_url && (
              <a
                href={project.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
                aria-label="View Source"
              >
                <Github className="w-5 h-5" />
              </a>
            )}
            {project.demo_url && (
              <a
                href={project.demo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
                aria-label="Live Demo"
              >
                <ExternalLink className="w-5 h-5" />
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
          {project.tech_stack.slice(0, 5).map((tech) => {
            const isActive = tech === currentTech;
            return (
              <Link
                key={tech}
                href={
                  isActive
                    ? "/projects"
                    : `/projects?tech=${encodeURIComponent(tech)}`
                }
                onClick={(e) => e.stopPropagation()}
              >
                <Badge
                  variant={isActive ? "default" : "secondary"}
                  interactive
                  active={isActive}
                  className="flex items-center gap-1"
                >
                  {hasTechIcon(tech) && (
                    <TechIcon name={tech} className="w-3 h-3" />
                  )}
                  {tech}
                </Badge>
              </Link>
            );
          })}
          {project.tech_stack.length > 5 && (
            <Badge variant="secondary">+{project.tech_stack.length - 5}</Badge>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
