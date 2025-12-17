import { Calendar } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/projects/markdown";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  type ADR,
  getAllProjects,
  getProject,
  getProjectADR,
  type Project,
} from "@/lib/projects";
import { cn } from "@/lib/styles";

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
  let project: Project;
  let adr: ADR;

  try {
    project = getProject(slug);
    adr = getProjectADR(slug, adrSlug);
  } catch (_e) {
    notFound();
  }

  // Find ADRs that this one supersedes (automatic backlinks)
  const supersededAdrs = project.adrs.filter(
    (a) => a.superseded_by === adr.slug,
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
            <Badge
              variant={
                adr.status === "Accepted" ||
                adr.status === "Deprecated" ||
                adr.status === "Proposed"
                  ? "default"
                  : adr.status === "Rejected"
                    ? "destructive"
                    : "secondary"
              }
              className={cn(
                "px-3 py-1",
                adr.status === "Accepted" && "bg-green-600",
                adr.status === "Proposed" && "bg-blue-600",
                adr.status === "Deprecated" && "bg-amber-600",
              )}
            >
              {adr.status}
            </Badge>

            <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
              <Calendar className="w-4 h-4" />
              {adr.date}
            </div>
          </div>

          {adr.status === "Deprecated" && adr.superseded_by && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                This decision has been superseded by{" "}
                <Link
                  href={`/projects/${slug}/adrs/${adr.superseded_by}`}
                  className="font-semibold underline underline-offset-4 hover:text-amber-700 dark:hover:text-amber-300"
                >
                  {project.adrs.find((a) => a.slug === adr.superseded_by)
                    ?.title || adr.superseded_by}
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
          <Markdown source={adr.content} />
        </div>
      </div>
    </div>
  );
}
