import type { CooklangRecipe } from "../types/extraction";

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
          <span className="text-xs font-medium text-gray-500">Cuisine</span>
          <input
            type="text"
            value={value.frontmatter.cuisine ?? ""}
            onChange={(e) => updateFrontmatter("cuisine", e.target.value || undefined)}
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
          onChange={(e) => onChange({ ...value, body: e.target.value })}
          rows={18}
          className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded outline-none focus:border-blue-400 font-mono resize-y"
        />
      </label>

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
