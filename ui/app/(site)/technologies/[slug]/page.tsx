import {
  Briefcase,
  ExternalLink,
  FileText,
  FolderKanban,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { TechPagination } from "@/components/technology/tech-pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getTechIconUrl } from "@/lib/api/tech-icons";
import { siteConfig } from "@/lib/config/site-config";
import { loadDomainRepository } from "@/lib/domain";
import {
  getAllTechnologyBadgesSorted,
  getAllTechnologySlugs,
  getRelatedContentForTechnology,
  getTechnologyDetail,
} from "@/lib/domain/technology";

interface RelatedItem {
  key: string;
  href: string;
  title: string;
  subtitle: ReactNode;
}

function RelatedContentSection({
  icon: Icon,
  heading,
  items,
}: {
  icon: LucideIcon;
  heading: string;
  items: RelatedItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
        <Icon className="w-5 h-5 text-primary" />
        {heading}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Link key={item.key} href={item.href} className="h-full">
            <Card className="h-full p-4 hover:shadow-md hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {item.subtitle}
                  </p>
                </div>
                <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

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
      type: "website",
    },
    twitter: {
      title: `${technology.name} - Robbie Palmer`,
      description,
      card: "summary",
    },
    alternates: {
      canonical: `${siteConfig.url}/technologies/${slug}`,
    },
  };
}

// Responsive behavior for the pagination container:
// Goal: On desktop, keep buttons on the same row as metadata, shifted right.
// If forced to a new row (e.g. by nav bar layout shifts), fill the row (flex-grow) rather than leaving whitespace.
// - Default (Mobile) & lg (Desktop): Full width, flex-grow. (Fills row when layout is constrained/buttons wrap).
// - md (Tablet) & xl (Wide): Auto width, ml-auto. (Sits inline with metadata).
const PAGINATION_CONTAINER_CLASSES =
  "w-full flex-grow min-w-[200px] md:w-auto md:flex-grow-0 md:ml-auto lg:w-full lg:flex-grow lg:ml-0 xl:w-auto xl:flex-grow-0 xl:ml-auto";

export default async function TechnologyPage({ params }: PageProps) {
  const { slug } = await params;
  const repository = loadDomainRepository();
  const technology = getTechnologyDetail(repository, slug);

  if (!technology) {
    notFound();
  }

  const relatedContent = getRelatedContentForTechnology(repository, slug);
  const iconUrl = getTechIconUrl(technology.name, technology.iconSlug);

  const allTechnologies = getAllTechnologyBadgesSorted(repository);
  const currentIndex = allTechnologies.findIndex((t) => t.slug === slug);
  const prevTech =
    currentIndex > 0 ? allTechnologies[currentIndex - 1] : undefined;
  const nextTech =
    currentIndex < allTechnologies.length - 1
      ? allTechnologies[currentIndex + 1]
      : undefined;

  const hasRelatedContent =
    relatedContent.projects.length > 0 ||
    relatedContent.blogs.length > 0 ||
    relatedContent.roles.length > 0;

  return (
    <div className="max-w-4xl">
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
            <div className="flex flex-wrap items-center gap-4">
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
              <TechPagination
                prevTech={prevTech}
                nextTech={nextTech}
                compact
                className={PAGINATION_CONTAINER_CLASSES}
              />
            </div>
          </div>
        </div>

        {hasRelatedContent && (
          <>
            <Separator />

            <div className="space-y-8">
              <RelatedContentSection
                icon={FolderKanban}
                heading="Projects"
                items={relatedContent.projects.map((project) => ({
                  key: project.slug,
                  href: `/projects/${project.slug}`,
                  title: project.title,
                  subtitle: (
                    <span className="capitalize">
                      {project.status.replace("_", " ")}
                    </span>
                  ),
                }))}
              />
              <RelatedContentSection
                icon={FileText}
                heading="Blog Posts"
                items={relatedContent.blogs.map((blog) => ({
                  key: blog.slug,
                  href: `/blog/${blog.slug}`,
                  title: blog.title,
                  subtitle: `${blog.date} \u00b7 ${blog.readingTime}`,
                }))}
              />
              <RelatedContentSection
                icon={Briefcase}
                heading="Experience"
                items={relatedContent.roles.map((role) => ({
                  key: role.slug,
                  href: `/experience#${role.slug}`,
                  title: `${role.title} at ${role.company}`,
                  subtitle: `${role.startDate} - ${role.endDate || "Present"}`,
                }))}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
