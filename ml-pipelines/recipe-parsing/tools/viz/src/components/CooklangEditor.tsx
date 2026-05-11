import { useCallback, useMemo } from "react";
import { extractIngredientSlugsFromBody } from "../../../../src/lib/cooklang.js";
import type { CooklangRecipe, CooklangFrontmatter } from "../types/extraction";

interface CooklangEditorProps {
  value: CooklangRecipe;
  diagnostics?: string[];
  onChange: (value: CooklangRecipe) => void;
}

export function CooklangEditor({
  value,
  diagnostics = [],
  onChange,
}: CooklangEditorProps) {
  function updateFrontmatter<K extends keyof CooklangRecipe["frontmatter"]>(
    key: K,
    next: CooklangRecipe["frontmatter"][K],
  ) {
    onChange({
      ...value,
      frontmatter: { ...value.frontmatter, [key]: next },
    });
  }

  const bodySlugs = useMemo(
    () => extractIngredientSlugsFromBody(value.body),
    [value.body],
  );

  /** When the cooklang body changes, drop annotation keys that no longer appear
   *  in the body and migrate their values to unannotated body slugs. */
  const reconcileAnnotations = useCallback(
    (nextBody: string): CooklangFrontmatter["ingredientAnnotations"] => {
      const annotations = value.frontmatter.ingredientAnnotations;
      if (!annotations) return undefined;
      const nextSlugs = new Set(extractIngredientSlugsFromBody(nextBody));
      const kept: NonNullable<CooklangFrontmatter["ingredientAnnotations"]> = {};
      const orphaned: { slug: string; ann: { preparation?: string; note?: string } }[] = [];

      for (const [slug, ann] of Object.entries(annotations)) {
        if (nextSlugs.has(slug)) {
          kept[slug] = ann;
        } else {
          orphaned.push({ slug, ann });
        }
      }

      return Object.keys(kept).length > 0 ? kept : undefined;
    },
    [value.frontmatter.ingredientAnnotations],
  );

  const allSlugs = useMemo(() => {
    const set = new Set(bodySlugs);
    for (const key of Object.keys(value.frontmatter.ingredientAnnotations ?? {})) {
      set.add(key);
    }
    return [...set].sort();
  }, [bodySlugs, value.frontmatter.ingredientAnnotations]);

  function updateAnnotation(
    slug: string,
    field: "preparation" | "note",
    text: string,
  ) {
    const current = value.frontmatter.ingredientAnnotations ?? {};
    const entry = current[slug] ?? {};
    const updated = { ...entry, [field]: text || undefined };

    const isEmpty = !updated.preparation && !updated.note;
    const next = { ...current };
    if (isEmpty) {
      delete next[slug];
    } else {
      next[slug] = updated;
    }

    const hasAny = Object.keys(next).length > 0;
    updateFrontmatter("ingredientAnnotations", hasAny ? next : undefined);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">
        Cooklang
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Title</span>
          <input
            type="text"
            value={value.frontmatter.title ?? ""}
            onChange={(e) => updateFrontmatter("title", e.target.value || undefined)}
            className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-blue-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Cuisine (comma-separated)</span>
          <input
            type="text"
            value={value.frontmatter.cuisine?.join(", ") ?? ""}
            onChange={(e) => {
              const parsed = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
              updateFrontmatter("cuisine", parsed.length > 0 ? parsed : undefined);
            }}
            className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-blue-400"
          />
        </label>
        <label className="block col-span-2">
          <span className="text-xs font-medium text-gray-500">Description</span>
          <textarea
            value={value.frontmatter.description ?? ""}
            onChange={(e) =>
              updateFrontmatter("description", e.target.value || undefined)
            }
            rows={2}
            className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-blue-400 resize-y"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Servings</span>
          <input
            type="number"
            min="1"
            value={value.frontmatter.servings ?? ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              updateFrontmatter(
                "servings",
                e.target.value && Number.isFinite(n) ? n : undefined,
              );
            }}
            className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-blue-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Prep Time</span>
          <input
            type="number"
            min="0"
            value={value.frontmatter.prepTime ?? ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              updateFrontmatter(
                "prepTime",
                e.target.value && Number.isFinite(n) ? n : undefined,
              );
            }}
            className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-blue-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Cook Time</span>
          <input
            type="number"
            min="0"
            value={value.frontmatter.cookTime ?? ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              updateFrontmatter(
                "cookTime",
                e.target.value && Number.isFinite(n) ? n : undefined,
              );
            }}
            className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-blue-400"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-gray-900">Cooklang Body</span>
        <textarea
          value={value.body}
          onChange={(e) => {
            const nextBody = e.target.value;
            const nextAnnotations = reconcileAnnotations(nextBody);
            onChange({
              ...value,
              body: nextBody,
              frontmatter: {
                ...value.frontmatter,
                ingredientAnnotations: nextAnnotations,
              },
            });
          }}
          rows={18}
          className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded outline-none focus:border-blue-400 font-mono resize-y"
        />
      </label>

      {allSlugs.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-gray-900 mb-2">
            Ingredient Annotations
          </div>
          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_1fr] gap-px bg-gray-100 px-2 py-1.5">
              <span className="text-xs font-medium text-gray-500">Ingredient</span>
              <span className="text-xs font-medium text-gray-500">Preparation</span>
              <span className="text-xs font-medium text-gray-500">Note</span>
            </div>
            <div className="divide-y divide-gray-100">
              {allSlugs.map((slug) => {
                const ann = value.frontmatter.ingredientAnnotations?.[slug];
                const isOrphaned = !bodySlugs.includes(slug);
                return (
                  <div
                    key={slug}
                    className={`grid grid-cols-[1fr_1fr_1fr] gap-2 px-2 py-1.5 items-center ${
                      isOrphaned ? "bg-amber-50" : ""
                    }`}
                  >
                    <span
                      className={`text-xs font-mono truncate ${
                        isOrphaned ? "text-amber-600 italic" : "text-gray-700"
                      }`}
                      title={isOrphaned ? "Not found in body" : slug}
                    >
                      {slug}
                    </span>
                    <input
                      type="text"
                      value={ann?.preparation ?? ""}
                      onChange={(e) =>
                        updateAnnotation(slug, "preparation", e.target.value)
                      }
                      placeholder="e.g. chopped"
                      className="w-full px-1.5 py-1 text-xs border border-gray-200 rounded outline-none focus:border-blue-400"
                    />
                    <input
                      type="text"
                      value={ann?.note ?? ""}
                      onChange={(e) =>
                        updateAnnotation(slug, "note", e.target.value)
                      }
                      placeholder="e.g. optional"
                      className="w-full px-1.5 py-1 text-xs border border-gray-200 rounded outline-none focus:border-blue-400"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {diagnostics.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-amber-700 mb-2">
            Diagnostics
          </div>
          <ul className="space-y-1 text-sm text-amber-900">
            {diagnostics.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
