"use client";

import { Network } from "lucide-react";
import { FilterableCardGrid } from "@/components/ui/filterable-card-grid";
import type { InitiativeWithProjects } from "@/lib/api/initiatives";
import { InitiativeCard } from "./initiative-card";

function getLatestRelatedProjectUpdate(
  initiative: InitiativeWithProjects,
): string | undefined {
  return initiative.projects.reduce<string | undefined>((latest, project) => {
    const projectUpdate = project.updated ?? project.date;
    return !latest || projectUpdate > latest ? projectUpdate : latest;
  }, undefined);
}

export function InitiativeList({
  initiatives,
}: Readonly<{ initiatives: InitiativeWithProjects[] }>) {
  return (
    <FilterableCardGrid
      items={initiatives}
      getItemKey={(initiative) => initiative.slug}
      searchConfig={{
        placeholder: "Search initiatives...",
        ariaLabel: "Search initiatives",
        keys: [
          { name: "title", weight: 3 },
          { name: "description", weight: 2 },
          { name: "projects.title", weight: 2 },
          { name: "content", weight: 1 },
        ],
        threshold: 0.3,
      }}
      sortConfig={{
        getDate: (initiative) => initiative.date,
        getUpdated: (initiative) =>
          getLatestRelatedProjectUpdate(initiative) ??
          initiative.updated ??
          initiative.date,
      }}
      defaultSort="updated"
      emptyState={{
        icon: <Network className="size-10 text-muted-foreground/50" />,
        message: "No initiatives found matching your search.",
      }}
      itemName="initiatives"
      renderCard={(initiative) => <InitiativeCard initiative={initiative} />}
    />
  );
}
