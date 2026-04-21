import type { ReviewManifest } from "../types/review";
import { MetricsSummaryBar } from "../components/MetricsSummaryBar";
import { EntryGrid } from "../components/EntryGrid";
import { CategoryAggregateTable } from "../components/CategoryAggregateTable";

interface DashboardViewProps {
  manifest: ReviewManifest;
  onSelectEntry: (entryId: string) => void;
}

export function DashboardView({
  manifest,
  onSelectEntry,
}: DashboardViewProps) {
  return (
    <div className="space-y-6">
      <MetricsSummaryBar
        metrics={manifest.headlineMetrics}
        inferFailuresCount={manifest.inferFailuresCount}
      />

      <section>
        <h2 className="text-lg font-semibold mb-3">
          Entries ({manifest.entryCount}) — sorted worst first
        </h2>
        <EntryGrid entries={manifest.entries} onSelectEntry={onSelectEntry} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">
          Category Aggregates
        </h2>
        <CategoryAggregateTable aggregates={manifest.categoryAggregates} />
      </section>

      {manifest.unknownPredictedSlugs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">
            Unknown Predicted Slugs
          </h2>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap gap-2">
              {manifest.unknownPredictedSlugs.map((s) => (
                <span
                  key={s.slug}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-700 text-xs font-medium"
                >
                  {s.slug}
                  {s.count > 1 && (
                    <span className="text-red-500">x{s.count}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
