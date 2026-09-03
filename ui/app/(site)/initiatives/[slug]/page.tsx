import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  getAllInitiativeSlugs,
  getInitiative,
  type InitiativeWithProjects,
} from "@/lib/api/initiatives";

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface InitiativeSection {
  title: string;
  source: string;
}

function getInitiativeSections(content: string): InitiativeSection[] {
  const normalized = content.trim();

  if (!normalized.startsWith("## ")) {
    return [{ title: "About", source: normalized }];
  }

  return normalized
    .slice(3)
    .split("\n## ")
    .map((block) => {
      const bodyStart = block.indexOf("\n");

      if (bodyStart === -1) {
        return { title: block.trim(), source: "" };
      }

      return {
        title: block.slice(0, bodyStart).trim(),
        source: block.slice(bodyStart + 1).trim(),
      };
    });
}

export function generateStaticParams() {
  return getAllInitiativeSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  try {
    const initiative = getInitiative(slug);
    return {
      title: `${initiative.title} - Initiative`,
      description: initiative.description,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Initiative not found:")
    ) {
      return { title: "Initiative Not Found" };
    }
    throw error;
  }
}

export default async function InitiativePage({ params }: Readonly<PageProps>) {
  const { slug } = await params;
  let initiative: InitiativeWithProjects;

  try {
    initiative = getInitiative(slug);
  } catch (_error) {
    notFound();
  }

  const firstProject = initiative.projects[0];
  const lastProject = initiative.projects.at(-1);
  const dateRange =
    firstProject && lastProject
      ? `${firstProject.date.slice(0, 4)} to ${lastProject.date.slice(0, 4)}`
      : null;
  const sections = getInitiativeSections(initiative.content);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
      <nav
        aria-label="Breadcrumb"
        className="mb-8 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
      >
        <Link href="/projects" className="underline-offset-4 hover:underline">
          Projects
        </Link>
        <span>/</span>
        <span>{initiative.title}</span>
      </nav>

      <header className="max-w-4xl">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Initiative
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-6xl">
          {initiative.title}
        </h1>
        <p className="mt-5 max-w-3xl text-xl leading-8 text-muted-foreground">
          {initiative.description}
        </p>
        <p className="mt-5 text-sm text-muted-foreground">
          {initiative.projects.length}{" "}
          {initiative.projects.length === 1 ? "project" : "projects"}
          {dateRange ? `, ${dateRange}` : ""}
        </p>
      </header>

      <Separator className="my-10" />

      <div className="max-w-4xl border-y">
        {sections.map((section, index) => (
          <section
            key={section.title}
            className={`grid gap-3 py-7 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-8 ${
              index > 0 ? "border-t" : ""
            }`}
          >
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </h2>
            <Markdown
              source={section.source}
              className="prose prose-zinc dark:prose-invert max-w-3xl prose-p:first:mt-0 prose-p:last:mb-0"
            />
          </section>
        ))}
      </div>

      <section aria-labelledby="initiative-projects" className="mt-14">
        <div className="max-w-3xl">
          <h2 id="initiative-projects" className="text-2xl font-semibold">
            Projects advancing this goal
          </h2>
          <p className="mt-2 leading-7 text-muted-foreground">
            Each project approached a different part of the same problem. The
            notes below explain the connection.
          </p>
        </div>

        <div className="relative mt-8">
          <div
            aria-hidden="true"
            className="absolute bottom-8 left-[11px] top-8 w-0.5 bg-gradient-to-b from-primary/50 via-primary/30 to-primary/10 md:left-[19px]"
          />
          <ol className="space-y-6">
            {initiative.projects.map((project) => (
              <li key={project.slug} className="relative pl-10 md:pl-14">
                <span className="absolute left-[3px] top-8 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary bg-background md:left-[11px] md:h-6 md:w-6">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary md:h-2 md:w-2" />
                </span>
                <Card className="group relative gap-5 overflow-hidden transition-all hover:border-primary/50 hover:shadow-lg">
                  <Link
                    href={`/projects/${project.slug}`}
                    className="absolute inset-0 z-0"
                  >
                    <span className="sr-only">View {project.title}</span>
                  </Link>
                  <CardHeader className="gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-mono tabular-nums">
                          {project.date.slice(0, 4)}
                        </span>
                        {project.role && (
                          <>
                            <span aria-hidden="true">/</span>
                            <span>{project.role.company}</span>
                          </>
                        )}
                      </div>
                      <CardTitle className="text-xl">
                        <h3 className="transition-colors group-hover:text-primary">
                          {project.title}
                        </h3>
                      </CardTitle>
                      <p className="max-w-3xl leading-7 text-muted-foreground">
                        {project.contribution ?? project.description}
                      </p>
                    </div>
                    <ProjectStatusBadge status={project.status} />
                  </CardHeader>
                  {(project.adrs.length > 0 || project.tags.length > 0) && (
                    <CardFooter className="flex flex-wrap gap-2 border-t text-sm text-muted-foreground">
                      {project.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                      {project.adrs.length > 0 && (
                        <Badge variant="outline">
                          {project.adrs.length}{" "}
                          {project.adrs.length === 1 ? "decision" : "decisions"}
                        </Badge>
                      )}
                    </CardFooter>
                  )}
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="mt-10">
        <Link
          href="/projects#all-projects"
          className="text-sm font-medium underline underline-offset-4"
        >
          Browse all projects
        </Link>
      </div>
    </div>
  );
}
