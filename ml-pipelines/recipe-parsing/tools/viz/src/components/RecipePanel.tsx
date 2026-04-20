import type { ParsedRecipe } from "recipe-domain";
import { formatIngredient, formatTime } from "../lib/format";

interface RecipePanelProps {
  recipe: ParsedRecipe;
  label: string;
}

export function RecipePanel({ recipe, label }: RecipePanelProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
        {label}
      </div>

      <h3 className="text-xl font-bold mb-1">{recipe.title}</h3>
      <p className="text-sm text-gray-600 mb-3">{recipe.description}</p>

      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-4">
        {recipe.cuisine && (
          <span className="px-2 py-0.5 rounded bg-gray-100 font-medium">
            {recipe.cuisine}
          </span>
        )}
        <span>{recipe.servings} servings</span>
        {recipe.prepTime != null && <span>Prep: {formatTime(recipe.prepTime)}</span>}
        {recipe.cookTime != null && <span>Cook: {formatTime(recipe.cookTime)}</span>}
      </div>

      <div className="mb-4">
        <h4 className="font-semibold text-sm mb-2">Ingredients</h4>
        {recipe.ingredientGroups.map((group, gi) => (
          <div key={gi} className="mb-2">
            {group.name && (
              <div className="text-sm font-medium text-gray-700 mb-1">
                {group.name}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item, ii) => (
                <li
                  key={`${gi}-${ii}`}
                  className="text-sm flex items-start gap-1.5"
                >
                  <span className="text-gray-300 mt-1.5 h-1 w-1 rounded-full bg-current shrink-0" />
                  <span>{formatIngredient(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div>
        <h4 className="font-semibold text-sm mb-2">Instructions</h4>
        <ol className="space-y-1.5 list-decimal list-inside">
          {recipe.instructions.map((step, i) => (
            <li key={i} className="text-sm leading-relaxed pl-1">
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
