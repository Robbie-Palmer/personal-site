# Vale styles

Vale loads its rule packages from this directory.

## Vendored packages

`proselint/` and `write-good/` are upstream packages imported in
`e0e9a198` (the deterministic prose linting PR). The default configuration does
not load them because their broad heuristics produced thousands of false
positives. The optional audit described below still uses them. Treat them as
read-only:

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

Vale reports only error-level rules from the project-owned `Unslop` style.
These are high-confidence merge blockers. Rewrite the prose when a rule has
found a style problem. Vale skips blockquote syntax, which covers quotations
and Markdown callouts whose wording must remain exact. Preserve any other
deliberate wording with an exact entry in `scripts/prose-exemptions.json`. Each
exemption must name one file, line, and check. Do not exempt an entire file or
rule to hide one false positive.

Warning and suggestion rules are disabled because their broad heuristics
produce too many unactionable findings. Promote a rule to `error` only after it
has proved precise enough to enforce and the repository is clean against it.
Do not keep advisory findings as a permanent lint backlog.

## Optional audit

Run `mise run //:lint:prose:audit` to scan all tracked Markdown and MDX with
`Unslop`, `write-good`, and `proselint`. Pass file paths after `--` for a focused
scan. The wrapper retains the normal path and exact-instance exclusions. The
task prints error, warning, and suggestion findings but returns success when it
finds them. Vale execution and configuration failures still fail the task.

The audit is a discovery tool and is not part of the default lint or CI tasks.
When a rule repeatedly finds real problems, copy or tighten it in `Unslop`, scan
the repository, and promote it to `error` only when its output is precise and
the repository is clean.
