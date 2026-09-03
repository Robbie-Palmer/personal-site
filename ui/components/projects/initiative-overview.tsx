import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {initiatives.map((initiative) => (
          <Card
            key={initiative.slug}
            className="group relative h-full gap-5 overflow-hidden transition-all hover:border-primary/50 hover:shadow-lg"
          >
            <Link
              href={`/initiatives/${initiative.slug}`}
              className="absolute inset-0 z-0"
            >
              <span className="sr-only">View {initiative.title}</span>
            </Link>

            <CardHeader className="gap-3">
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-xl transition-colors group-hover:text-primary">
                  <h3>{initiative.title}</h3>
                </CardTitle>
                <Badge variant="outline">
                  {initiative.projects.length}{" "}
                  {initiative.projects.length === 1 ? "project" : "projects"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="flex-1">
              <p className="leading-7 text-muted-foreground">
                {initiative.description}
              </p>
            </CardContent>

            {initiative.projects.length > 0 && (
              <CardFooter className="flex-col items-stretch border-t">
                <div className="w-full">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Project timeline
                  </p>
                  <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-border">
                    {initiative.projects.slice(0, 4).map((project) => (
                      <li
                        key={project.slug}
                        className="relative grid grid-cols-[12px_2.75rem_minmax(0,1fr)] items-baseline gap-2 text-sm"
                      >
                        <span
                          aria-hidden="true"
                          className="relative z-10 h-3 w-3 rounded-full border-2 border-primary bg-card"
                        />
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {project.date.slice(0, 4)}
                        </span>
                        <Link
                          href={`/projects/${project.slug}`}
                          className="relative z-10 font-medium leading-5 underline-offset-4 hover:text-primary hover:underline"
                        >
                          {project.title}
                        </Link>
                      </li>
                    ))}
                    {initiative.projects.length > 4 && (
                      <li className="relative grid grid-cols-[12px_2.75rem_minmax(0,1fr)] items-center gap-2 text-sm text-muted-foreground">
                        <span
                          aria-hidden="true"
                          className="relative z-10 h-3 w-3 rounded-full border-2 border-muted-foreground/50 bg-card"
                        />
                        <span />
                        <span>
                          +{initiative.projects.length - 4} more{" "}
                          {initiative.projects.length - 4 === 1
                            ? "project"
                            : "projects"}
                        </span>
                      </li>
                    )}
                  </ol>
                </div>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}
