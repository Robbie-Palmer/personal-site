# Vale styles

Vale loads its rule packages from this directory.

## Vendored packages

`proselint/` and `write-good/` are upstream packages imported in
`e0e9a198` (the deterministic prose linting PR). Treat them as read-only:

- Do not edit, extend, or trim them.
- To change a rule, do not patch the vendored file. Write a rule in a
  style of your own (see below) or replace the vendored package wholly.

## Styles authored here

`Unslop/` is the project's own style set. Add or edit rules there when you
want the site's voice enforced (AI-tell vocabulary, filler phrases, and
related heuristics). Name the directory to match the intent, keep one
concern per `.yml` file, and use `level: error` only for rules the repo
must not merge against.

## Review coverage

Review tooling skips the vendored packages (`proselint/`, `write-good/`)
because they are upstream files under `.vale`; the `Unslop/` style set is
ordinary project source and is reviewed. The repo's own markdown, YAML,
and prose linters ignore the whole `.vale` tree.

## Alert triage

Vale reports only error-level rules. These are high-confidence merge blockers.
Rewrite the prose when a rule has found a style problem. Preserve deliberate
wording, quotations, safety warnings, and concise trust boundaries with an
exact entry in `scripts/prose-exemptions.json`. Each exemption must name one
file, line, and check. Do not exempt an entire file or rule to hide one false
positive.

Warning and suggestion rules are disabled because their broad heuristics
produce too many unactionable findings. Promote a rule to `error` only after it
has proved precise enough to enforce and the repository is clean against it.
Do not keep advisory findings as a permanent lint backlog.
