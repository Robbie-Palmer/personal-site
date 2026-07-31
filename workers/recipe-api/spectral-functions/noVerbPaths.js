// Flags path segments that read as verbs (RPC-style) rather than resources,
// e.g. /recipes/import-url or /pantry/restore. Legitimate state-transition
// actions live in ACTION_ALLOWLIST; extend it deliberately in review rather
// than suppressing findings inline, per recipe-site ADR 065.
const ACTION_ALLOWLIST = new Set([
  "accept",
  "decline",
  "leave",
  "read-all",
  "clear-all",
]);

// A segment is verb-shaped when its leading hyphen-token is one of these.
// Named read views (discover, cooks) are intentionally absent.
const VERB_PREFIXES = new Set([
  "import",
  "restore",
  "recommend",
  "generate",
  "validate",
  "sync",
  "create",
  "update",
  "delete",
  "fetch",
  "send",
]);

export default (path) => {
  if (typeof path !== "string") return [];
  const results = [];
  for (const segment of path.split("/")) {
    if (!segment || segment.startsWith("{")) continue;
    if (ACTION_ALLOWLIST.has(segment)) continue;
    if (VERB_PREFIXES.has(segment.split("-")[0])) {
      results.push({
        message: `path segment '${segment}' is a verb; model it as a resource`,
      });
    }
  }
  return results;
};
