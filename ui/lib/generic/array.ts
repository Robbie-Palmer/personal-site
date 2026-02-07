/**
 * Reorders items so that those matching the selected slugs appear first,
 * preserving relative order within each group.
 */
export function prioritiseSelected<T extends { slug: string }>(
  items: T[],
  selectedSlugs: string[],
): T[] {
  if (selectedSlugs.length === 0) return items;
  const selected = items.filter((t) => selectedSlugs.includes(t.slug));
  const unselected = items.filter((t) => !selectedSlugs.includes(t.slug));
  return [...selected, ...unselected];
}
