// Warns when a collection segment (one that has item routes under a path
// parameter, e.g. /households/{householdId}) is not plural. Singletons that
// cannot meaningfully pluralise are allowlisted. Starts at `warn` because
// pluralisation heuristics need tuning against real paths — see ADR 065.
const SINGLETONS = new Set([
  "pantry",
  "profile",
  "diet",
  "recipe-box",
  "health",
]);

export default (path) => {
  if (typeof path !== "string") return [];
  const segments = path.split("/").filter(Boolean);
  const results = [];
  segments.forEach((segment, i) => {
    const next = segments[i + 1];
    const isCollection = Boolean(next && next.startsWith("{"));
    if (!isCollection || segment.startsWith("{")) return;
    if (SINGLETONS.has(segment) || segment.endsWith("s")) return;
    results.push({ message: `collection '${segment}' should be plural` });
  });
  return results;
};
