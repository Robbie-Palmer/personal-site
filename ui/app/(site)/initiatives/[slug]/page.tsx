import { ArrowRight, Target } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  getAllInitiativeSlugs,
  getInitiative,
  type InitiativeWithProjects,
} from "@/lib/api/initiatives";

interface PageProps {
  params: Promise<{ slug: string }>;
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
  } catch (_error) {
    // The page below turns unknown initiative slugs into a 404 response.
    return { title: "Initiative Not Found" };
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
        <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          <Target className="h-4 w-4" /> Initiative
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

      <Card className="max-w-4xl bg-muted/20">
        <CardContent>
          <Markdown
            source={initiative.content}
            className="prose prose-zinc dark:prose-invert max-w-3xl"
          />
        </CardContent>
      </Card>

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

        <ol className="mt-6 grid gap-5">
          {initiative.projects.map((project, index) => (
            <li key={project.slug}>
              <Card className="gap-5 transition-all hover:border-primary/50 hover:shadow-md">
                <CardHeader className="gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold tabular-nums text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="text-xl">
                      <h3>
                        <Link
                          href={`/projects/${project.slug}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {project.title}
                        </Link>
                      </h3>
                    </CardTitle>
                    <p className="max-w-3xl leading-7 text-muted-foreground">
                      {project.contribution ?? project.description}
                    </p>
                  </div>
                  <ProjectStatusBadge status={project.status} />
                </CardHeader>
                <CardFooter className="flex flex-wrap justify-between gap-4 border-t text-sm text-muted-foreground">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{project.date.slice(0, 4)}</Badge>
                    {project.role && (
                      <Badge variant="outline">{project.role.company}</Badge>
                    )}
                    {project.adrs.length > 0 && (
                      <Badge variant="outline">
                        {project.adrs.length}{" "}
                        {project.adrs.length === 1 ? "decision" : "decisions"}
                      </Badge>
                    )}
                  </div>
                  <Link
                    href={`/projects/${project.slug}`}
                    className="inline-flex items-center gap-2 font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Read the project <ArrowRight className="h-4 w-4" />
                  </Link>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ol>
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
