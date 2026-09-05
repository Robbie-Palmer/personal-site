import { Network } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InitiativeWithProjects } from "@/lib/api/initiatives";
import { InitiativeStatusBadge } from "./initiative-status-badge";

export function InitiativeCard({
  initiative,
}: Readonly<{ initiative: InitiativeWithProjects }>) {
  const projectCount = initiative.projects.length;

  return (
    <Card className="flex h-full flex-col transition-all hover:border-primary/50 hover:shadow-lg">
      <CardHeader>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <InitiativeStatusBadge status={initiative.status} />
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Network className="size-4" />
            {projectCount} {projectCount === 1 ? "project" : "projects"}
          </span>
        </div>
        <CardTitle>
          <Link
            href={`/initiatives/${initiative.slug}`}
            className="hover:text-primary hover:underline hover:underline-offset-4"
          >
            {initiative.title}
          </Link>
        </CardTitle>
        <CardDescription>{initiative.description}</CardDescription>
      </CardHeader>
      <div className="flex-grow" />
      <CardFooter>
        <Link
          href={`/initiatives/${initiative.slug}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          View initiative
        </Link>
      </CardFooter>
    </Card>
  );
}
