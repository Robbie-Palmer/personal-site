import { Calendar, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmblaDemoCarousel } from "@/components/adrs/embla-demo-carousel";
import { RechartsDemoChart } from "@/components/adrs/recharts-demo-chart";
import { Mermaid } from "@/components/mermaid";
import { ADRBadge } from "@/components/projects/adr-badge";
import { ADRPagination } from "@/components/projects/adr-pagination";
import { Markdown } from "@/components/projects/markdown";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  type ADRDetailView,
  getAllProjects,
  getProject,
  getProjectADR,
  type ProjectWithADRs,
} from "@/lib/projects";
import { getTechUrl, hasTechIcon, TechIcon } from "@/lib/tech-icons";

const adrComponents = {
  EmblaDemoCarousel,
  RechartsDemoChart,
  Mermaid,
};

// Responsive behavior for the pagination container:
// Goal: On desktop, keep buttons on the same row as metadata, shifted right.
// If forced to a new row (e.g. by nav bar layout shifts), fill the row (flex-grow) rather than leaving whitespace.
// - Default (Mobile) & lg (Desktop): Full width, flex-grow. (Fills row when layout is constrained/buttons wrap).
// - md (Tablet) & xl (Wide): Auto width, ml-auto. (Sits inline with metadata).
const PAGINATION_CONTAINER_CLASSES =
  "w-full flex-grow md:w-auto md:flex-grow-0 md:ml-auto lg:w-full lg:flex-grow lg:ml-0 xl:w-auto xl:flex-grow-0 xl:ml-auto";

interface PageProps {
  params: Promise<{ slug: string; adrSlug: string }>;
}

export async function generateStaticParams() {
  const projects = getAllProjects();
  return projects.flatMap((project) =>
    project.adrs.map((adr) => ({
      slug: project.slug,
      adrSlug: adr.slug,
    })),
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { slug, adrSlug } = await params;
  try {
    const project = getProject(slug);
    const adr = getProjectADR(slug, adrSlug);
    return {
      title: `${adr.title} - ${project.title} - ADR`,
      description: `Architecture Decision Record for ${project.title}: ${adr.title}`,
    };
  } catch (_e) {
    return {
      title: "ADR Not Found",
    };
  }
}

export default async function ADRPage({ params }: PageProps) {
  const { slug, adrSlug } = await params;
  let project: ProjectWithADRs;
  let adr: ADRDetailView;

  try {
    project = getProject(slug);
    adr = getProjectADR(slug, adrSlug);
  } catch (_e) {
    notFound();
  }

  // Find ADRs that this one supersedes (automatic backlinks)
  const supersededAdrs = project.adrs.filter(
    (a) => a.supersededBy === adr.slug,
  );

  const currentIndex = project.adrs.findIndex((a) => a.slug === adr.slug);
  const prevAdr = currentIndex > 0 ? project.adrs[currentIndex - 1] : undefined;
  const nextAdr =
    currentIndex < project.adrs.length - 1
      ? project.adrs[currentIndex + 1]
      : undefined;

  return (
    <div className="max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link
              href="/projects"
              className="hover:underline underline-offset-4"
            >
              Projects
            </Link>
            <span>/</span>
            <Link
              href={`/projects/${slug}?tab=adrs`}
              className="hover:underline underline-offset-4"
            >
              {project.title}
            </Link>
            <span>/</span>
            <span>Architecture Decisions</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold">{adr.title}</h1>

          <div className="flex flex-wrap items-center gap-4">
            {adr.technologies && adr.technologies.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {adr.technologies.map((tech) => {
                  const url = getTechUrl(tech.name);
                  const content = (
                    <Badge
                      variant="secondary"
                      interactive={!!url}
                      className="flex items-center gap-1.5"
                    >
                      {hasTechIcon(tech.name) && (
                        <TechIcon name={tech.name} className="w-3 h-3" />
                      )}
                      <span>{tech.name}</span>
                      {url && <ExternalLink className="w-3 h-3 ml-0.5" />}
                    </Badge>
                  );
                  return (
                    <span key={tech.name}>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cursor-pointer"
                          aria-label={`Visit ${tech.name} website`}
                        >
                          {content}
                        </a>
                      ) : (
                        content
                      )}
                    </span>
                  );
                })}
              </div>
            )}

            <ADRBadge status={adr.status} className="px-3 py-1" />

            <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
              <Calendar className="w-4 h-4" />
              {adr.date}
            </div>

            <ADRPagination
              projectSlug={slug}
              prevAdr={prevAdr}
              nextAdr={nextAdr}
              compact
              className={PAGINATION_CONTAINER_CLASSES}
            />
          </div>

          {adr.status === "Deprecated" && adr.supersededBy && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                This decision has been superseded by{" "}
                <Link
                  href={`/projects/${slug}/adrs/${adr.supersededBy}`}
                  className="font-semibold underline underline-offset-4 hover:text-amber-700 dark:hover:text-amber-300"
                >
                  {project.adrs.find((a) => a.slug === adr.supersededBy)
                    ?.title || adr.supersededBy}
                </Link>
              </p>
            </div>
          )}

          {supersededAdrs.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                This decision supersedes:{" "}
                {supersededAdrs.map((superseded, index) => (
                  <span key={superseded.slug}>
                    <Link
                      href={`/projects/${slug}/adrs/${superseded.slug}`}
                      className="font-semibold underline underline-offset-4 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      {superseded.title}
                    </Link>
                    {index < supersededAdrs.length - 1 && ", "}
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>

        <Separator className="my-8" />

        <div className="prose dark:prose-invert max-w-none">
          <Markdown source={adr.content} components={adrComponents} />
        </div>
      </div>
    </div>
  );
}
