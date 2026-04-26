import { useState, useEffect } from "react";
import { DashboardView } from "./views/DashboardView";
import { EntryDetailView } from "./views/EntryDetailView";
import { CanonicalizationView } from "./views/CanonicalizationView";
import { ExtractionListView } from "./views/ExtractionListView";
import { ExtractionDetailView } from "./views/ExtractionDetailView";
import { CooklangListView } from "./views/CooklangListView";
import { CooklangDetailView } from "./views/CooklangDetailView";
import { loadManifest } from "./lib/data";
import type { ReviewManifest } from "./types/review";

type View =
  | { kind: "dashboard" }
  | { kind: "detail"; entryId: string }
  | { kind: "canonicalization" }
  | { kind: "extraction" }
  | { kind: "extraction-detail"; entryIndex: number }
  | { kind: "cooklang" }
  | { kind: "cooklang-detail"; entryIndex: number };

function parseHash(): View {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith("entry/")) {
    return { kind: "detail", entryId: hash.slice(6) };
  }
  if (hash.startsWith("extraction/") && /^\d+$/.test(hash.slice(11))) {
    return { kind: "extraction-detail", entryIndex: Number(hash.slice(11)) };
  }
  if (hash.startsWith("cooklang/") && /^\d+$/.test(hash.slice(9))) {
    return { kind: "cooklang-detail", entryIndex: Number(hash.slice(9)) };
  }
  if (hash === "canonicalization") {
    return { kind: "canonicalization" };
  }
  if (hash === "extraction") {
    return { kind: "extraction" };
  }
  if (hash === "cooklang") {
    return { kind: "cooklang" };
  }
  return { kind: "dashboard" };
}

function isExtractionView(view: View) {
  return view.kind === "extraction" || view.kind === "extraction-detail";
}

function isWideReviewView(view: View) {
  return (
    view.kind === "extraction" ||
    view.kind === "extraction-detail" ||
    view.kind === "cooklang" ||
    view.kind === "cooklang-detail"
  );
}

function assertNever(value: never): never {
  throw new Error(`Unhandled view kind: ${JSON.stringify(value)}`);
}

export function App() {
  const [view, setView] = useState<View>(parseHash);
  const [manifest, setManifest] = useState<ReviewManifest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadManifest().then(setManifest).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    const onHashChange = () => setView(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function navigate(v: View) {
    switch (v.kind) {
      case "dashboard":
        window.location.hash = "";
        break;
      case "detail":
        window.location.hash = `entry/${v.entryId}`;
        break;
      case "canonicalization":
        window.location.hash = "canonicalization";
        break;
      case "extraction":
        window.location.hash = "extraction";
        break;
      case "extraction-detail":
        window.location.hash = `extraction/${v.entryIndex}`;
        break;
      case "cooklang":
        window.location.hash = "cooklang";
        break;
      case "cooklang-detail":
        window.location.hash = `cooklang/${v.entryIndex}`;
        break;
      default:
        assertNever(v);
    }
    setView(v);
  }

  // Review workbench views don't need the manifest — show them regardless
  const needsManifest = !isWideReviewView(view);

  // If a manifest-dependent view is active but the manifest can't load,
  // redirect to extraction (which doesn't need the manifest) so the nav is
  // always reachable.
  useEffect(() => {
    if (needsManifest && error) {
      navigate({ kind: "extraction" });
    }
  }, [needsManifest, error]);

  if (needsManifest && !manifest && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
        <h1 className="font-semibold text-lg text-gray-900">
          Recipe Parsing Viz
        </h1>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => navigate({ kind: "dashboard" })}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              view.kind === "dashboard"
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => navigate({ kind: "extraction" })}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              isExtractionView(view)
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Extraction
          </button>
          <button
            type="button"
            onClick={() => navigate({ kind: "canonicalization" })}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              view.kind === "canonicalization"
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Canonicalization
          </button>
          <button
            type="button"
            onClick={() => navigate({ kind: "cooklang" })}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              view.kind === "cooklang" || view.kind === "cooklang-detail"
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Cooklang
          </button>
        </div>
      </nav>

      <main
        className={`mx-auto px-6 py-6 ${isWideReviewView(view) ? "max-w-[120rem]" : "max-w-7xl"}`}
      >
        {view.kind === "dashboard" && manifest && (
          <DashboardView
            manifest={manifest}
            onSelectEntry={(id) => navigate({ kind: "detail", entryId: id })}
          />
        )}
        {view.kind === "detail" && manifest && (
          <EntryDetailView
            entryId={view.entryId}
            manifest={manifest}
            onBack={() => navigate({ kind: "dashboard" })}
            onNavigate={(id) => navigate({ kind: "detail", entryId: id })}
          />
        )}
        {view.kind === "canonicalization" && manifest && (
          <CanonicalizationView
            manifest={manifest}
            onSelectEntry={(id) => navigate({ kind: "detail", entryId: id })}
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
        {view.kind === "cooklang" && (
          <CooklangListView
            onSelectEntry={(index) =>
              navigate({ kind: "cooklang-detail", entryIndex: index })
            }
          />
        )}
        {view.kind === "cooklang-detail" && (
          <CooklangDetailView
            entryIndex={view.entryIndex}
            onBack={() => navigate({ kind: "cooklang" })}
            onNavigate={(index) =>
              navigate({ kind: "cooklang-detail", entryIndex: index })
            }
          />
        )}
      </main>
    </div>
  );
}
