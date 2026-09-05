import type { InitiativeWithProjects } from "@/lib/api/initiatives";
import { InitiativeCard } from "./initiative-card";

export function InitiativeList({
  initiatives,
}: Readonly<{ initiatives: InitiativeWithProjects[] }>) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {initiatives.map((initiative) => (
        <InitiativeCard key={initiative.slug} initiative={initiative} />
      ))}
    </div>
  );
}
