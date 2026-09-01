import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { InitiativeWithProjects } from "@/lib/api/initiatives";

interface InitiativeOverviewProps {
  initiatives: InitiativeWithProjects[];
}

export function InitiativeOverview({
  initiatives,
}: Readonly<InitiativeOverviewProps>) {
  if (initiatives.length === 0) return null;

  return (
    <section aria-labelledby="initiatives-heading">
      <div className="max-w-3xl">
        <h2 id="initiatives-heading" className="text-2xl font-semibold">
          Initiatives
        </h2>
        <p className="mt-2 leading-7 text-muted-foreground">
          Longer-running goals that connect projects completed in different
          roles and at different points in time.
        </p>
      </div>

      <div className="mt-6 divide-y border-y">
        {initiatives.map((initiative) => (
          <article
            key={initiative.slug}
            className="grid gap-5 py-6 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.7fr)] md:gap-10"
          >
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Initiative
              </p>
              <h3 className="mt-2 text-xl font-semibold">
                <Link
                  href={`/initiatives/${initiative.slug}`}
                  className="underline-offset-4 hover:underline"
                >
                  {initiative.title}
                </Link>
              </h3>
              <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">
                {initiative.description}
              </p>
              <Link
                href={`/initiatives/${initiative.slug}`}
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
              >
                Read about the initiative
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div>
              <p className="text-sm font-medium">
                {initiative.projects.length}{" "}
                {initiative.projects.length === 1 ? "project" : "projects"}
              </p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {initiative.projects.map((project) => (
                  <li key={project.slug}>
                    <Link
                      href={`/projects/${project.slug}`}
                      className="underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {project.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
