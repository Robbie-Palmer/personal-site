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

export function validateSlug(filename: string): void {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, ""); // Remove extension
  const normalized = normalizeSlug(nameWithoutExt);
  if (nameWithoutExt !== normalized) {
    throw new Error(
      `Invalid filename: "${filename}". Filenames must be lowercase alphanumeric with hyphens (kebab-case). Expected: "${normalized}".`,
    );
  }
}
