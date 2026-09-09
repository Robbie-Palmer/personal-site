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

`freeze_cohort` assigns each artifact to train, development, or holdout using a
seeded hash. It allocates each artifact type separately, so the current
development and holdout sets both contain an ADR and a project page. The frozen
cohort ID covers the dataset, parameters, and exact membership.

The readiness report stays red until every artifact has a recorded edit
outcome. Git diffs show what changed, but they do not prove whether the author
accepted, rejected, or changed a native editor suggestion. Treating the
published text as blanket acceptance would corrupt the evaluation before it
starts.

Run the implemented stages directly:

```bash
mise run //ml-pipelines/writing-editor-evaluation:extract
mise run //ml-pipelines/writing-editor-evaluation:freeze
```

With access to the ML pipeline credentials, reproduce them through DVC:

```bash
mise run //ml-pipelines/writing-editor-evaluation:repro
```

The next stage will run Vale through `writing-editor-domain`. Model baselines
remain blocked until the project records their immutable revisions, runtime
locks, and weights.
