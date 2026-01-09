import { ExternalLink, Github, Globe } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Markdown } from "@/components/markdown";
import { ADRList } from "@/components/projects/adr-list";
import { ProjectRoleBadge } from "@/components/projects/project-role-badge";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { ProjectTabsSkeleton } from "@/components/projects/project-tabs-skeleton";
import { ProjectTechStack } from "@/components/projects/project-tech-stack";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  getAllProjectSlugs,
  getProject,
  type ProjectWithADRs,
} from "@/lib/projects";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getAllProjectSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  try {
    const project = getProject(slug);
    return {
      title: `${project.title} - Projects`,
      description: project.description,
    };
  } catch (_e) {
    return {
      title: "Project Not Found",
    };
  }
}

export default async function ProjectPage({ params }: PageProps) {
  const { slug } = await params;
  let project: ProjectWithADRs;

  try {
    project = getProject(slug);
  } catch (_e) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap mb-8">
        <Link href="/projects" className="hover:underline underline-offset-4">
          Projects
        </Link>
        <span>/</span>
        <span>{project.title}</span>
      </div>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <h1 className="text-4xl md:text-5xl font-bold">
                {project.title}
              </h1>
              <ProjectStatusBadge
                status={project.status}
                className="text-sm px-3 py-1"
              />
              {project.role && (
                <ProjectRoleBadge role={project.role} className="text-sm px-3 py-1" />
              )}
            </div>

            <p className="text-xl text-muted-foreground max-w-3xl leading-relaxed">
              {project.description}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <ProjectTechStack
                techStack={project.technologies.map((t) => t.name)}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {project.repoUrl && (
              <Button
                asChild
                variant="outline"
                className="gap-2 w-full sm:w-auto"
              >
                <a
                  href={project.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="w-4 h-4" />
                  View Source
                </a>
              </Button>
            )}
            {project.demoUrl && (
              <Button asChild className="gap-2 w-full sm:w-auto">
                <a
                  href={project.demoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4" />
                  Live Demo
                </a>
              </Button>
            )}
            {project.productUrl && (
              <Button asChild className="gap-2 w-full sm:w-auto">
                <a
                  href={project.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Globe className="w-4 h-4" />
                  Product Page
                </a>
              </Button>
            )}
          </div>
        </div>

        <Separator className="my-8" />

        {/* Content Tabs */}
        {project.adrs.length > 0 ? (
          <Suspense fallback={<ProjectTabsSkeleton />}>
            <ProjectTabs
              adrCount={project.adrs.length}
              overview={<Markdown source={project.content} />}
              adrs={
                <ADRList
                  projectSlug={project.slug}
                  adrs={project.adrs}
                  description={
                    <div className="prose dark:prose-invert max-w-none">
                      <p className="text-lg text-muted-foreground m-0">
                        Architecture Decision Records (ADRs) document the
                        important architectural choices made during the
                        development of this project, along with the context and
                        consequences of those decisions.
                      </p>
                    </div>
                  }
                />
              }
            />
          </Suspense>
        ) : (
          <Markdown source={project.content} />
        )}
      </div>
    </div>
  );
}
