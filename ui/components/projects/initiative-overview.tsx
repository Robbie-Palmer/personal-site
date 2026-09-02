import { ArrowRight, Target } from "lucide-react";
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
            className="group h-full gap-5 overflow-hidden transition-all hover:border-primary/50 hover:shadow-lg"
          >
            <CardHeader className="gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Target className="h-5 w-5" />
                </div>
                <Badge variant="outline">
                  {initiative.projects.length}{" "}
                  {initiative.projects.length === 1 ? "project" : "projects"}
                </Badge>
              </div>
              <CardTitle className="text-xl transition-colors group-hover:text-primary">
                <h3>
                  <Link
                    href={`/initiatives/${initiative.slug}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {initiative.title}
                  </Link>
                </h3>
              </CardTitle>
            </CardHeader>

            <CardContent className="flex-1">
              <p className="leading-7 text-muted-foreground">
                {initiative.description}
              </p>
            </CardContent>

            <CardFooter className="flex-col items-start gap-5 border-t">
              {initiative.projects.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Contributing projects
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {initiative.projects.slice(0, 4).map((project) => (
                      <Badge key={project.slug} variant="secondary" asChild>
                        <Link href={`/projects/${project.slug}`}>
                          {project.title}
                        </Link>
                      </Badge>
                    ))}
                    {initiative.projects.length > 4 && (
                      <Badge variant="secondary">
                        +{initiative.projects.length - 4}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              <Link
                href={`/initiatives/${initiative.slug}`}
                className="inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
              >
                Read about the initiative
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}
