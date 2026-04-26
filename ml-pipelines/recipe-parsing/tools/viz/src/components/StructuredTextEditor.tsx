import type { StructuredTextRecipe } from "../types/extraction";

interface StructuredTextEditorProps {
  value: StructuredTextRecipe;
  onChange: (value: StructuredTextRecipe) => void;
}

function linesToTextarea(lines: string[]): string {
  return lines.join("\n");
}

function textareaToLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function StructuredTextEditor({
  value,
  onChange,
}: StructuredTextEditorProps) {
  function update<K extends keyof StructuredTextRecipe>(
    key: K,
    next: StructuredTextRecipe[K],
  ) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">
        Structured Extraction
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Title</span>
          <input
            type="text"
            value={value.title ?? ""}
            onChange={(e) => update("title", e.target.value || undefined)}
            className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-blue-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Cuisine</span>
          <input
            type="text"
            value={value.cuisine ?? ""}
            onChange={(e) => update("cuisine", e.target.value || undefined)}
            className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-blue-400"
          />
        </label>
        <label className="block col-span-2">
          <span className="text-xs font-medium text-gray-500">Description</span>
          <textarea
            value={value.description ?? ""}
            onChange={(e) => update("description", e.target.value || undefined)}
            rows={2}
            className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-blue-400 resize-y"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Servings Text</span>
          <input
            type="text"
            value={value.servingsText ?? ""}
            onChange={(e) => update("servingsText", e.target.value || undefined)}
            className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-blue-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Prep Time Text</span>
          <input
            type="text"
            value={value.prepTimeText ?? ""}
            onChange={(e) => update("prepTimeText", e.target.value || undefined)}
            className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-blue-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Cook Time Text</span>
          <input
            type="text"
            value={value.cookTimeText ?? ""}
            onChange={(e) => update("cookTimeText", e.target.value || undefined)}
            className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-blue-400"
          />
        </label>
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Ingredient Sections</h4>
          <p className="text-xs text-gray-500">
            One line per extracted ingredient. Section names are optional.
          </p>
        </div>
        {value.ingredientSections.map((section, index) => (
          <div
            key={index}
            className="border border-gray-200 rounded p-3 space-y-2"
          >
            <input
              type="text"
              value={section.name ?? ""}
              onChange={(e) => {
                const ingredientSections = [...value.ingredientSections];
                ingredientSections[index] = {
                  ...section,
                  name: e.target.value || undefined,
                };
                update("ingredientSections", ingredientSections);
              }}
              placeholder="Section name"
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-blue-400"
            />
            <textarea
              value={linesToTextarea(section.lines)}
              onChange={(e) => {
                const ingredientSections = [...value.ingredientSections];
                ingredientSections[index] = {
                  ...section,
                  lines: textareaToLines(e.target.value),
                };
                update("ingredientSections", ingredientSections);
              }}
              rows={Math.max(section.lines.length, 3)}
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-blue-400 font-mono resize-y"
            />
          </div>
        ))}
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-gray-900">Instruction Lines</span>
        <textarea
          value={linesToTextarea(value.instructionLines)}
          onChange={(e) => update("instructionLines", textareaToLines(e.target.value))}
          rows={Math.max(value.instructionLines.length, 6)}
          className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-blue-400 resize-y"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Equipment</span>
          <textarea
            value={linesToTextarea(value.equipment)}
            onChange={(e) => update("equipment", textareaToLines(e.target.value))}
            rows={4}
            className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-blue-400 resize-y"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Notes</span>
          <textarea
            value={linesToTextarea(value.notes)}
            onChange={(e) => update("notes", textareaToLines(e.target.value))}
            rows={4}
            className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-blue-400 resize-y"
          />
        </label>
      </div>
    </div>
  );
}
