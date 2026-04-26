import type { ManifestEntry } from "../types/review";
import { EntryCard } from "./EntryCard";

interface EntryGridProps {
  entries: ManifestEntry[];
  onSelectEntry: (entryId: string) => void;
}

export function EntryGrid({ entries, onSelectEntry }: EntryGridProps) {
  const sorted = [...entries].sort(
    (a, b) => a.scores.overall - b.scores.overall,
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {sorted.map((entry) => (
        <EntryCard
          key={entry.entryId}
          entry={entry}
          onClick={() => onSelectEntry(entry.entryId)}
        />
      ))}
    </div>
  );
}
