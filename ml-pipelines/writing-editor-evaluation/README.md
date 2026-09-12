# Writing editor evaluation

This DVC project turns pinned Git revisions into a reproducible writing corpus,
runs detection-only checks, and aligns their findings with observed published
edits.

`extract_dataset` reads `corpus-manifest.json`. Each entry names a repository
path, a full source commit, and a full published commit. The extractor verifies
that both commits exist, checks that the source precedes the published revision,
loads the exact Git blobs, rejects unchanged pairs, and records SHA-256 hashes.
It validates every entry before replacing the current output directory.

The committed seed has nine public examples from the repository's Vale cleanup:
five ADRs and four project pages. The extracted text lives in DVC, not Git.
Private drafts can join later without changing that storage boundary.

`freeze_cohort` assigns each artifact to train, validation, or holdout using a
seeded hash. It allocates each artifact type separately, so the current
validation and holdout sets both contain an ADR and a project page. The frozen
cohort ID covers the dataset, parameters, and exact membership.

The readiness report stays red until every artifact has a recorded edit
outcome. Git diffs show what changed, but they do not prove whether the author
accepted, rejected, or changed a native editor suggestion. Treating the
published text as blanket acceptance would corrupt the evaluation before it
starts.

The Vale producer runs the pinned `3.20.0` binary against every frozen source
artifact with the repository's merge-blocking Unslop rules. It writes stable
finding IDs, rule provenance, severity, line and column positions, and exact
UTF-8 source spans to `outputs/producers/vale.json`. The producer hashes the
Vale config and rule directory into its version, so a rule change creates new
finding identities and invalidates the DVC stage. The producer disables Vale's
finding-based exit code, fails on process errors, and enforces the timeout in
`params.yaml`.

DVC invokes each stage through a checked-in shell script. Stage dependencies
cover the script, source, lockfile, parameters, and data inputs, but exclude the
root `.mise.toml`; unrelated development-tool changes must not invalidate the
writing pipeline cache.

Vale reports normalized text when Markdown markup occurs inside a match. The
producer keeps that report beside the exact marked-up source bytes. It fails on
stale source hashes, invalid locations, an unexpected Vale version, or output
that does not satisfy the runtime schema.

These records are findings because the active Vale rules identify passages but
cannot rewrite them safely. They contain no replacement text. A later rewrite
producer will turn selected findings into suggestions and proposals.

`match_edits` compares each source and published revision as Unicode code
points, then records the resulting edits as exact UTF-8 byte ranges. It labels a
finding `changed` when every overlapping edit stays inside its source span and
maps the whole span to its observed published text. It labels a finding
`unchanged` when no edit touches it. An edit that crosses the span, or an
insertion exactly on its boundary, becomes `manual-adjudication-required`.

The match output contains evidence about the final document, not an editorial
decision. It does not claim that a change accepted a Vale suggestion: Vale did
not provide a replacement, and the Git history does not record that decision.
The matcher verifies both revision hashes, the producer run and cohort, every
finding span, and its own runtime schema before writing
`outputs/matched/vale.json`.

On the initial cohort, 15 of 43 findings map to self-contained published
changes. The remaining 28 cross or touch finding boundaries and stay in the
manual-adjudication queue. The cohort intentionally contains no unchanged
findings because it was sampled from a Vale cleanup commit.

Run the implemented stages directly:

```bash
mise run //ml-pipelines/writing-editor-evaluation:extract
mise run //ml-pipelines/writing-editor-evaluation:freeze
mise run //ml-pipelines/writing-editor-evaluation:run:vale
mise run //ml-pipelines/writing-editor-evaluation:match:edits
```

With access to the ML pipeline credentials, reproduce them through DVC:

```bash
mise run //ml-pipelines/writing-editor-evaluation:repro
```

The rewrite producer remains an open design choice. Model baselines remain
blocked until the project records their immutable revisions, runtime locks,
and weights. The diff alignment can support that later evaluation without
pretending the published text came from a model that did not exist.
