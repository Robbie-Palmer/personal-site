import { ArrowLeft, ExternalLink, Github } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ADRList } from "@/components/projects/adr-list";
import { Markdown } from "@/components/projects/markdown";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { ProjectTabsSkeleton } from "@/components/projects/project-tabs-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getAllProjectSlugs, getProject, type Project } from "@/lib/projects";
import { hasTechIcon, TechIcon } from "@/lib/tech-icons";

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
  let project: Project;

  try {
    project = getProject(slug);
  } catch (_e) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Link
        href="/projects"
        className="text-sm text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-1 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to projects
      </Link>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold">{project.title}</h1>
            <div className="flex flex-wrap gap-2">
              {project.tech_stack.map((tech) => (
                <Link
                  key={tech}
                  href={`/projects?tech=${encodeURIComponent(tech)}`}
                >
                  <Badge
                    variant="secondary"
                    className="text-sm px-3 py-1 gap-1 hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
                  >
                    {hasTechIcon(tech) && (
                      <TechIcon name={tech} className="w-3 h-3" />
                    )}
                    {tech}
                  </Badge>
                </Link>
              ))}
            </div>
            <p className="text-xl text-muted-foreground max-w-3xl leading-relaxed">
              {project.description}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {project.repo_url && (
              <Button
                asChild
                variant="outline"
                className="gap-2 w-full sm:w-auto"
              >
                <a
                  href={project.repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="w-4 h-4" />
                  View Source
                </a>
              </Button>
            )}
            {project.demo_url && (
              <Button asChild className="gap-2 w-full sm:w-auto">
                <a
                  href={project.demo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4" />
                  Live Demo
                </a>
              </Button>
            )}
          </div>
        </div>

        <Separator className="my-8" />

        {/* Content Tabs */}
        <Suspense fallback={ProjectTabsSkeleton()}>
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
      </div>
    </div>
  );
}
