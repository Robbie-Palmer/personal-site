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
  const selected = items.filter((item) => selectedKeys.includes(getKey(item)));
  const unselected = items.filter(
    (item) => !selectedKeys.includes(getKey(item)),
  );
  return [...selected, ...unselected];
}
