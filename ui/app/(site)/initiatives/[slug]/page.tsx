import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
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
      <div className="mb-8 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/projects" className="underline-offset-4 hover:underline">
          Projects
        </Link>
        <span>/</span>
        <span>Initiative</span>
        <span>/</span>
        <span>{initiative.title}</span>
      </div>

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

      <Markdown
        source={initiative.content}
        className="prose prose-zinc dark:prose-invert max-w-3xl"
      />

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

        <ol className="mt-6 divide-y border-y">
          {initiative.projects.map((project, index) => (
            <li
              key={project.slug}
              className="grid gap-4 py-6 sm:grid-cols-[2.5rem_minmax(0,1fr)]"
            >
              <span className="pt-1 text-sm tabular-nums text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-semibold">
                    <Link
                      href={`/projects/${project.slug}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {project.title}
                    </Link>
                  </h3>
                  <ProjectStatusBadge status={project.status} />
                </div>
                <p className="mt-2 max-w-3xl leading-7">
                  {project.contribution ?? project.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span>{project.date.slice(0, 4)}</span>
                  {project.role && <span>{project.role.company}</span>}
                  {project.adrs.length > 0 && (
                    <span>
                      {project.adrs.length}{" "}
                      {project.adrs.length === 1 ? "decision" : "decisions"}
                    </span>
                  )}
                </div>
                <Link
                  href={`/projects/${project.slug}`}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
                >
                  Read the project <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
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
