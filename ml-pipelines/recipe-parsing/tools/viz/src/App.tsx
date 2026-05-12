import { useState, useEffect } from "react";
import { StatsView } from "./views/StatsView";
import { ExtractionListView } from "./views/ExtractionListView";
import { ExtractionDetailView } from "./views/ExtractionDetailView";
import { NormalizationListView } from "./views/NormalizationListView";
import { NormalizationDetailView } from "./views/NormalizationDetailView";
import { CanonicalizeListView } from "./views/CanonicalizeListView";
import { CanonicalizeDetailView } from "./views/CanonicalizeDetailView";

type View =
  | { kind: "stats" }
  | { kind: "extraction" }
  | { kind: "extraction-detail"; entryIndex: number }
  | { kind: "normalization" }
  | { kind: "normalization-detail"; entryIndex: number }
  | { kind: "canonicalize" }
  | { kind: "canonicalize-detail"; entryIndex: number };

function parseHash(): View {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith("extraction/") && /^\d+$/.test(hash.slice(11))) {
    return { kind: "extraction-detail", entryIndex: Number(hash.slice(11)) };
  }
  if (hash.startsWith("normalization/") && /^\d+$/.test(hash.slice(14))) {
    return { kind: "normalization-detail", entryIndex: Number(hash.slice(14)) };
  }
  if (hash.startsWith("canonicalize/") && /^\d+$/.test(hash.slice(13))) {
    return { kind: "canonicalize-detail", entryIndex: Number(hash.slice(13)) };
  }
  if (hash === "extraction") return { kind: "extraction" };
  if (hash === "normalization") return { kind: "normalization" };
  if (hash === "canonicalize") return { kind: "canonicalize" };
  return { kind: "stats" };
}

function isWideView(view: View) {
  return view.kind !== "stats";
}

function assertNever(value: never): never {
  throw new Error(`Unhandled view kind: ${JSON.stringify(value)}`);
}

const TABS: { kind: View["kind"]; label: string; hash: string }[] = [
  { kind: "stats", label: "Stats", hash: "" },
  { kind: "extraction", label: "Extraction", hash: "extraction" },
  { kind: "normalization", label: "Normalization", hash: "normalization" },
  { kind: "canonicalize", label: "Canonicalize", hash: "canonicalize" },
];

function isTabActive(tabKind: string, viewKind: string): boolean {
  if (tabKind === viewKind) return true;
  if (tabKind === "extraction" && viewKind === "extraction-detail") return true;
  if (tabKind === "normalization" && viewKind === "normalization-detail") return true;
  if (tabKind === "canonicalize" && viewKind === "canonicalize-detail") return true;
  return false;
}

export function App() {
  const [view, setView] = useState<View>(parseHash);

  useEffect(() => {
    const onHashChange = () => setView(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function navigate(v: View) {
    switch (v.kind) {
      case "stats":
        window.location.hash = "";
        break;
      case "extraction":
        window.location.hash = "extraction";
        break;
      case "extraction-detail":
        window.location.hash = `extraction/${v.entryIndex}`;
        break;
      case "normalization":
        window.location.hash = "normalization";
        break;
      case "normalization-detail":
        window.location.hash = `normalization/${v.entryIndex}`;
        break;
      case "canonicalize":
        window.location.hash = "canonicalize";
        break;
      case "canonicalize-detail":
        window.location.hash = `canonicalize/${v.entryIndex}`;
        break;
      default:
        assertNever(v);
    }
    setView(v);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
        <h1 className="font-semibold text-lg text-gray-900">
          Recipe Parsing Viz
        </h1>
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.kind}
              type="button"
              onClick={() => navigate({ kind: tab.kind } as View)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                isTabActive(tab.kind, view.kind)
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main
        className={`mx-auto px-6 py-6 ${isWideView(view) ? "max-w-[120rem]" : "max-w-7xl"}`}
      >
        {view.kind === "stats" && (
          <StatsView
            onSelectCanonicalizeEntry={(index) =>
              navigate({ kind: "canonicalize-detail", entryIndex: index })
            }
          />
        )}
        {view.kind === "extraction" && (
          <ExtractionListView
            onSelectEntry={(index) =>
              navigate({ kind: "extraction-detail", entryIndex: index })
            }
          />
        )}
        {view.kind === "extraction-detail" && (
          <ExtractionDetailView
            entryIndex={view.entryIndex}
            onBack={() => navigate({ kind: "extraction" })}
            onNavigate={(index) =>
              navigate({ kind: "extraction-detail", entryIndex: index })
            }
          />
        )}
        {view.kind === "normalization" && (
          <NormalizationListView
            onSelectEntry={(index) =>
              navigate({ kind: "normalization-detail", entryIndex: index })
            }
          />
        )}
        {view.kind === "normalization-detail" && (
          <NormalizationDetailView
            entryIndex={view.entryIndex}
            onBack={() => navigate({ kind: "normalization" })}
            onNavigate={(index) =>
              navigate({ kind: "normalization-detail", entryIndex: index })
            }
          />
        )}
        {view.kind === "canonicalize" && (
          <CanonicalizeListView
            onSelectEntry={(index) =>
              navigate({ kind: "canonicalize-detail", entryIndex: index })
            }
          />
        )}
        {view.kind === "canonicalize-detail" && (
          <CanonicalizeDetailView
            entryIndex={view.entryIndex}
            onBack={() => navigate({ kind: "canonicalize" })}
            onNavigate={(index) =>
              navigate({ kind: "canonicalize-detail", entryIndex: index })
            }
          />
        )}
      </main>
    </div>
  );
}
