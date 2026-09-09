import { ArrowRight, Network } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InitiativeWithProjects } from "@/lib/api/initiatives";
import type { RoleListItemView } from "@/lib/domain/role/roleViews";
import { InitiativeStatusBadge } from "./initiative-status-badge";

const STATUS_ORDER = { active: 0, idea: 1, inactive: 2 } as const;

function getInitiativeCompanies(
  initiative: InitiativeWithProjects,
): RoleListItemView[] {
  const companies = new Map<string, RoleListItemView>();
  const newestProjectsFirst = [...initiative.projects].sort((a, b) =>
    (b.updated ?? b.date).localeCompare(a.updated ?? a.date),
  );

  for (const project of newestProjectsFirst) {
    if (project.role && !companies.has(project.role.company)) {
      companies.set(project.role.company, project.role);
    }
  }

  return Array.from(companies.values());
}

function getInitiativeYears(initiative: InitiativeWithProjects): string {
  const startYear = initiative.date.slice(0, 4);
  if (initiative.status === "active") return `Since ${startYear}`;

  const endDate = initiative.projects.reduce((latest, project) => {
    const projectDate = project.updated ?? project.date;
    return projectDate > latest ? projectDate : latest;
  }, initiative.updated ?? initiative.date);
  const endYear = endDate.slice(0, 4);

  return startYear === endYear ? startYear : `${startYear} to ${endYear}`;
}

export function HomeInitiatives({
  initiatives,
}: Readonly<{ initiatives: InitiativeWithProjects[] }>) {
  if (initiatives.length === 0) return null;
  const orderedInitiatives = [...initiatives].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      (b.updated ?? b.date).localeCompare(a.updated ?? a.date),
  );

  return (
    <section aria-labelledby="home-initiatives-heading">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Initiatives
          </p>
          <h2
            id="home-initiatives-heading"
            className="text-3xl font-bold tracking-tight"
          >
            What I&apos;m building toward
          </h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            Longer-running goals that connect projects across roles and years.
          </p>
        </div>
        <Link
          href="/projects"
          className="group/link inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Explore all initiatives
          <ArrowRight className="size-4 transition-transform group-hover/link:translate-x-0.5" />
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {orderedInitiatives.map((initiative) => {
          const companies = getInitiativeCompanies(initiative);
          const initiativeHref = `/initiatives/${initiative.slug}`;
          const projectCount = initiative.projects.length;

          return (
            <Card
              key={initiative.slug}
              className="group relative h-full gap-5 overflow-hidden transition-all hover:border-primary/50 hover:shadow-lg"
            >
              <Link href={initiativeHref} className="absolute inset-0 z-0">
                <span className="sr-only">View {initiative.title}</span>
              </Link>

              <CardHeader className="gap-5">
                <div className="flex min-h-9 items-start justify-between gap-4">
                  <InitiativeStatusBadge
                    status={initiative.status}
                    className="pointer-events-none relative z-10"
                  />
                  {companies.length > 0 && (
                    <div className="relative z-10 flex -space-x-2">
                      {companies.map((company) => (
                        <Link
                          key={company.slug}
                          href={`/experience#${company.slug}`}
                          aria-label={`View experience at ${company.company}`}
                          title={company.company}
                          className="relative flex size-9 items-center justify-center rounded-md border bg-background p-1 ring-2 ring-card transition-transform hover:z-10 hover:-translate-y-0.5"
                        >
                          <Image
                            src={company.logoPath}
                            alt={`${company.company} logo`}
                            width={28}
                            height={28}
                            className="size-7 object-contain"
                          />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <CardTitle className="text-xl leading-snug transition-colors group-hover:text-primary">
                  <h3>{initiative.title}</h3>
                </CardTitle>
              </CardHeader>

              <CardContent className="flex-1">
                <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                  {initiative.description}
                </p>
              </CardContent>

              <CardFooter className="justify-between gap-3 border-t text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Network className="size-3.5" />
                  {projectCount} {projectCount === 1 ? "project" : "projects"}
                </span>
                <span>{getInitiativeYears(initiative)}</span>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
