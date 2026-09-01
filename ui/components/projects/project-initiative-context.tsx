import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { InitiativeWithProjects } from "@/lib/api/initiatives";

interface ProjectInitiativeContextProps {
  initiatives: InitiativeWithProjects[];
  projectSlug: string;
}

export function ProjectInitiativeContext({
  initiatives,
  projectSlug,
}: Readonly<ProjectInitiativeContextProps>) {
  if (initiatives.length === 0) return null;

  return (
    <div className="space-y-4 border-l-2 pl-4 sm:pl-5">
      {initiatives.map((initiative) => {
        const contribution =
          initiative.projectContributions[projectSlug] ??
          initiative.description;
        return (
          <div key={initiative.slug}>
            <p className="text-sm text-muted-foreground">
              Contributes to{" "}
              <Link
                href={`/initiatives/${initiative.slug}`}
                className="font-medium text-foreground underline underline-offset-4"
              >
                {initiative.title}
              </Link>
            </p>
            <p className="mt-1 max-w-3xl text-sm leading-6">{contribution}</p>
          </div>
        );
      })}
    </div>
  );
}

export function InitiativeProjectNavigation({
  initiatives,
  projectSlug,
}: Readonly<ProjectInitiativeContextProps>) {
  const initiative = initiatives[0];
  if (initiatives.length !== 1 || !initiative) return null;
  if (initiative.projects.length < 2) return null;

  const currentIndex = initiative.projects.findIndex(
    (project) => project.slug === projectSlug,
  );
  if (currentIndex < 0) return null;

  const previous = initiative.projects[currentIndex - 1];
  const next = initiative.projects[currentIndex + 1];

  return (
    <nav
      aria-label={`More projects in ${initiative.title}`}
      className="mt-12 border-t pt-8"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Continue through the initiative</p>
          <Link
            href={`/initiatives/${initiative.slug}`}
            className="mt-1 inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {initiative.title}
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Project {currentIndex + 1} of {initiative.projects.length}
        </p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {previous ? (
          <Link
            href={`/projects/${previous.slug}`}
            className="group rounded-lg border p-4 hover:bg-muted/50"
          >
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Previous project
            </span>
            <span className="mt-2 block font-medium">{previous.title}</span>
          </Link>
        ) : (
          <div />
        )}
        {next && (
          <Link
            href={`/projects/${next.slug}`}
            className="group rounded-lg border p-4 text-right hover:bg-muted/50"
          >
            <span className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
              Next project <ArrowRight className="h-3.5 w-3.5" />
            </span>
            <span className="mt-2 block font-medium">{next.title}</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
