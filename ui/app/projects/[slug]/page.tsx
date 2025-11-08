import { ExternalLink, Github } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/date";
import { renderMDX } from "@/lib/mdx";
import { getAllProjectSlugs, getProjectBySlug } from "@/lib/projects";
import { siteConfig } from "@/lib/site-config";

export function generateStaticParams() {
  return getAllProjectSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata(
  props: PageProps<"/projects/[slug]">,
): Promise<Metadata> {
  const params = await props.params;
  const { slug } = params;
  const validSlugs = getAllProjectSlugs();
  if (!validSlugs.includes(slug)) {
    notFound();
  }

  const project = getProjectBySlug(slug);
  const url = `${siteConfig.url}/projects/${slug}`;

  return {
    title: project.title,
    description: project.description,
    authors: [
      { name: siteConfig.author.name, url: siteConfig.author.linkedin },
    ],
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: project.title,
      description: project.description,
      url,
      siteName: siteConfig.name,
      type: "article",
      publishedTime: project.date,
      modifiedTime: project.updated || project.date,
      authors: [siteConfig.author.name],
      tags: project.tags,
      images: [
        {
          url: siteConfig.ogImage,
          width: 1200,
          height: 630,
          alt: project.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: project.title,
      description: project.description,
      images: [siteConfig.ogImage],
    },
  };
}

export default async function ProjectPage(
  props: PageProps<"/projects/[slug]">,
) {
  const params = await props.params;
  const { slug } = params;

  const project = getProjectBySlug(slug);

  return (
    <article className="container mx-auto px-4 py-12 max-w-4xl">
      <Link
        href="/projects"
        className="text-sm text-muted-foreground hover:text-foreground mb-8 inline-block"
      >
        ← Back to projects
      </Link>

      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{project.title}</h1>
        <p className="text-xl text-muted-foreground mb-4">
          {project.description}
        </p>

        {(project.company || project.role) && (
          <p className="text-lg text-muted-foreground mb-4">
            {project.role}
            {project.role && project.company && " at "}
            {project.company}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 text-sm mb-4">
          <div className="text-muted-foreground">
            <time>{formatDate(project.date)}</time>
            <span className="mx-2">·</span>
            <span>{project.readingTime}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <Link key={tag} href={`/projects?tag=${encodeURIComponent(tag)}`}>
                <Badge variant="secondary">{tag}</Badge>
              </Link>
            ))}
          </div>
        </div>

        {project.technologies && project.technologies.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {project.technologies.map((tech) => (
              <Badge key={tech} variant="outline">
                {tech}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          {project.githubUrl && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-4 w-4 mr-2" />
                View Source
              </a>
            </Button>
          )}
          {project.demoUrl && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={project.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Live Demo
              </a>
            </Button>
          )}
          {project.experienceLink && (
            <Button variant="outline" size="sm" asChild>
              <Link href={project.experienceLink}>View Experience</Link>
            </Button>
          )}
        </div>
      </header>

      <Separator className="mb-8" />

      <div className="prose prose-zinc dark:prose-invert max-w-none">
        {renderMDX(project.content)}
      </div>
    </article>
  );
}
