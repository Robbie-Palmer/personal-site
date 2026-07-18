/**
 * Reorders items so that those whose key is in `selectedKeys` appear first,
 * preserving relative order within each group.
 */
export function prioritiseSelected<T>(
  items: T[],
  selectedKeys: string[],
  getKey: (item: T) => string,
): T[] {
  if (selectedKeys.length === 0) return items;
  const selectedKeySet = new Set(selectedKeys);
  const selected: T[] = [];
  const unselected: T[] = [];
  for (const item of items) {
    (selectedKeySet.has(getKey(item)) ? selected : unselected).push(item);
  }
  return [...selected, ...unselected];
}
