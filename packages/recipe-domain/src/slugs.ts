const RECIPE_APP_ROUTE_SLUGS = new Set([
  "add",
  "cooks",
  "discover",
  "edit",
  "kitchen",
  "notifications",
  "onboarding",
  "profile",
  "saved",
  "settings",
  "shopping",
]);

export function isRecipeAppRouteSlug(slug: string): boolean {
  return RECIPE_APP_ROUTE_SLUGS.has(slug);
}

export function normalizeSlug(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/\+\+/g, "plusplus")
    .replace(/#/g, "sharp")
    .replace(/\./g, "dot")
    .replace(/\s+/g, "-") // Spaces to hyphens
    .replace(/[^a-z0-9-]+/g, "") // Remove remaining special chars
    .replace(/-{2,}/g, "-") // Collapse consecutive hyphens
    .replace(/(^-|-$)/g, ""); // Remove leading/trailing hyphens
}
