import { useState, useMemo } from "react";
import type {
  CanonicalizationFile,
  CanonicalizationMethod,
  CanonicalizationDecision,
} from "../types/canonicalization";
import { MethodBadge } from "./MethodBadge";
import { humanizeSlug } from "../lib/format";

interface CanonicalizationTableProps {
  data: CanonicalizationFile;
  onSelectEntry?: (entryId: string) => void;
  /** Map from image filename to entryId */
  imageToEntryId: Map<string, string>;
}

type SortField = "score" | "method" | "slug";

const ALL_METHODS: CanonicalizationMethod[] = [
  "exact",
  "fuzzy",
  "none",
];

interface FlatDecision extends CanonicalizationDecision {
  image: string;
  entryId: string | undefined;
}

export function CanonicalizationTable({
  data,
  onSelectEntry,
  imageToEntryId,
}: CanonicalizationTableProps) {
  const [methodFilter, setMethodFilter] = useState<CanonicalizationMethod | "all">(
    "all",
  );
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortAsc, setSortAsc] = useState(true);

  const flatDecisions = useMemo(() => {
    const result: FlatDecision[] = [];
    for (const entry of data.entries) {
      if (!entry.images || entry.images.length === 0) continue;
      const image = entry.images[0]!;
      const entryId = imageToEntryId.get(image);
      for (const d of entry.decisions) {
        result.push({ ...d, image, entryId });
      }
    }
    return result;
  }, [data, imageToEntryId]);

  const filtered = useMemo(() => {
    let items =
      methodFilter !== "all"
        ? flatDecisions.filter((d) => d.method === methodFilter)
        : [...flatDecisions];
    items.sort((a, b) => {
      let cmp = 0;
      if (sortField === "score") {
        if (a.score === undefined && b.score === undefined) cmp = 0;
        else if (a.score === undefined) cmp = 1;
        else if (b.score === undefined) cmp = -1;
        else cmp = sortAsc ? a.score - b.score : b.score - a.score;
        return cmp;
      }
      if (sortField === "method") cmp = a.method.localeCompare(b.method);
      else cmp = a.originalSlug.localeCompare(b.originalSlug);
      return sortAsc ? cmp : -cmp;
    });
    return items;
  }, [flatDecisions, methodFilter, sortField, sortAsc]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortAsc ? " \u25B2" : " \u25BC") : "";

  const ariaSort = (field: SortField) =>
    sortField === field ? (sortAsc ? "ascending" : "descending") : "none";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">Filter by method:</span>
        <button
          type="button"
          onClick={() => setMethodFilter("all")}
          className={`text-xs px-2 py-1 rounded ${methodFilter === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          All ({flatDecisions.length})
        </button>
        {ALL_METHODS.map((m) => {
          const count = flatDecisions.filter((d) => d.method === m).length;
          if (count === 0) return null;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMethodFilter(m)}
              className={`text-xs px-2 py-1 rounded ${methodFilter === m ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {m} ({count})
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th
                className="text-left px-4 py-2 font-medium text-gray-600"
                aria-sort={ariaSort("slug")}
              >
                <button
                  type="button"
                  onClick={() => toggleSort("slug")}
                  className="font-medium text-gray-600 hover:text-gray-900"
                >
                  Original{sortIndicator("slug")}
                </button>
              </th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">
                Canonical
              </th>
              <th
                className="text-left px-4 py-2 font-medium text-gray-600"
                aria-sort={ariaSort("method")}
              >
                <button
                  type="button"
                  onClick={() => toggleSort("method")}
                  className="font-medium text-gray-600 hover:text-gray-900"
                >
                  Method{sortIndicator("method")}
                </button>
              </th>
              <th
                className="text-right px-4 py-2 font-medium text-gray-600"
                aria-sort={ariaSort("score")}
              >
                <button
                  type="button"
                  onClick={() => toggleSort("score")}
                  className="font-medium text-gray-600 hover:text-gray-900"
                >
                  Score{sortIndicator("score")}
                </button>
              </th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">
                Entry
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => {
              const changed = d.originalSlug !== d.canonicalSlug;
              return (
                <tr
                  key={`${d.image}-${d.originalSlug}-${i}`}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-2 font-mono text-xs">
                    {humanizeSlug(d.originalSlug)}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {changed ? (
                      <span className="font-semibold">
                        {humanizeSlug(d.canonicalSlug)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <MethodBadge method={d.method} />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {d.score?.toFixed(2) ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    {d.entryId && onSelectEntry ? (
                      <button
                        type="button"
                        onClick={() => onSelectEntry(d.entryId!)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        view
                      </button>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-gray-400 py-6 text-sm">
            No decisions match the current filter.
          </div>
        )}
      </div>
    </div>
  );
}
