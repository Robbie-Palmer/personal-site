# Writing editor evaluation

This DVC project turns pinned Git revisions into a reproducible writing corpus.
Its first two stages establish the data boundary required by ADR 004.

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
finding identities and invalidates the DVC stage.

Vale reports normalized text when Markdown markup occurs inside a match. The
producer keeps that report beside the exact marked-up source bytes. It fails on
stale source hashes, invalid locations, an unexpected Vale version, or output
that does not satisfy the runtime schema.

These records are findings because the active Vale rules identify passages but
cannot rewrite them safely. They contain no replacement text. A later rewrite
producer will turn selected findings into suggestions and proposals.

Run the implemented stages directly:

```bash
mise run //ml-pipelines/writing-editor-evaluation:extract
mise run //ml-pipelines/writing-editor-evaluation:freeze
mise run //ml-pipelines/writing-editor-evaluation:run:vale
```

With access to the ML pipeline credentials, reproduce them through DVC:

```bash
mise run //ml-pipelines/writing-editor-evaluation:repro
```

The next producer will propose rewrites for the areas Vale identifies. Model
baselines remain blocked until the project records their immutable revisions,
runtime locks, and weights.
