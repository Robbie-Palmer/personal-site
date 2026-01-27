import {
  Briefcase,
  ExternalLink,
  FileText,
  FolderKanban,
  Layers,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getTechIconUrl } from "@/lib/api/tech-icons";
import { siteConfig } from "@/lib/config/site-config";
import { loadDomainRepository } from "@/lib/domain";
import {
  getAllTechnologySlugs,
  getRelatedContentForTechnology,
  getTechnologyDetail,
} from "@/lib/domain/technology";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const repository = loadDomainRepository();
  const slugs = getAllTechnologySlugs(repository);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const repository = loadDomainRepository();
  const technology = getTechnologyDetail(repository, slug);

  if (!technology) {
    return {
      title: "Technology Not Found",
    };
  }

  const description =
    technology.description ||
    `Learn about ${technology.name} and see projects, blog posts, and experience using this technology.`;

  return {
    title: `${technology.name} - Technologies`,
    description,
    openGraph: {
      title: `${technology.name} - Robbie Palmer`,
      description,
      url: `${siteConfig.url}/technologies/${slug}`,
    },
    twitter: {
      title: `${technology.name} - Robbie Palmer`,
      description,
    },
    alternates: {
      canonical: `${siteConfig.url}/technologies/${slug}`,
    },
  };
}

export default async function TechnologyPage({ params }: PageProps) {
  const { slug } = await params;
  const repository = loadDomainRepository();
  const technology = getTechnologyDetail(repository, slug);

  if (!technology) {
    notFound();
  }

  const relatedContent = getRelatedContentForTechnology(repository, slug);
  const iconUrl = getTechIconUrl(technology.name, technology.iconSlug);

  const hasRelatedContent =
    relatedContent.projects.length > 0 ||
    relatedContent.blogs.length > 0 ||
    relatedContent.roles.length > 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap mb-8">
        <Link
          href="/experience#technologies"
          className="hover:underline underline-offset-4"
        >
          Technologies
        </Link>
        <span>/</span>
        <span>{technology.name}</span>
      </div>

      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {iconUrl && (
            <div className="shrink-0 w-20 h-20 flex items-center justify-center bg-muted rounded-lg p-4">
              <Image
                src={iconUrl}
                alt={technology.name}
                width={64}
                height={64}
                className="object-contain brightness-0 dark:invert"
              />
            </div>
          )}
          <div className="space-y-3 flex-1">
            <h1 className="text-4xl md:text-5xl font-bold">
              {technology.name}
            </h1>
            {technology.description && (
              <p className="text-xl text-muted-foreground leading-relaxed">
                {technology.description}
              </p>
            )}
            <Button asChild variant="outline" className="gap-2">
              <a
                href={technology.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-4 h-4" />
                Official Website
              </a>
            </Button>
          </div>
        </div>

        {hasRelatedContent && (
          <>
            <Separator />

            <div className="space-y-8">
              {/* Projects */}
              {relatedContent.projects.length > 0 && (
                <section>
                  <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                    <FolderKanban className="w-5 h-5 text-primary" />
                    Projects
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {relatedContent.projects.map((project) => (
                      <Link
                        key={project.slug}
                        href={`/projects/${project.slug}`}
                      >
                        <Card className="p-4 hover:shadow-md hover:border-primary/50 transition-all">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <h3 className="font-medium">{project.title}</h3>
                              <p className="text-sm text-muted-foreground capitalize">
                                {project.status.replace("_", " ")}
                              </p>
                            </div>
                            <Layers className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Blog Posts */}
              {relatedContent.blogs.length > 0 && (
                <section>
                  <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Blog Posts
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {relatedContent.blogs.map((blog) => (
                      <Link key={blog.slug} href={`/blog/${blog.slug}`}>
                        <Card className="p-4 hover:shadow-md hover:border-primary/50 transition-all">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <h3 className="font-medium">{blog.title}</h3>
                              <p className="text-sm text-muted-foreground">
                                {blog.date} &middot; {blog.readingTime}
                              </p>
                            </div>
                            <FileText className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Roles */}
              {relatedContent.roles.length > 0 && (
                <section>
                  <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-primary" />
                    Experience
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {relatedContent.roles.map((role) => (
                      <Link key={role.slug} href={`/experience#${role.slug}`}>
                        <Card className="p-4 hover:shadow-md hover:border-primary/50 transition-all">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <h3 className="font-medium">
                                {role.title} at {role.company}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {role.startDate} - {role.endDate || "Present"}
                              </p>
                            </div>
                            <Briefcase className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
