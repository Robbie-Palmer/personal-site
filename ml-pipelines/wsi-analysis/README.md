# WSI analysis dataset

This project versions a small CPTAC-COAD computational-pathology dataset and
the tiles derived from it. DVC stores both datasets in the private Cloudflare
R2 `dvc` bucket. Its S3-compatible API is why the committed remote starts with
`s3://`; the custom `endpointurl` sends every DVC request to R2.

The current sample contains two IDC cases. Derived tiles exist for one slide.
See [`dataset.json`](dataset.json) for provenance, attribution, licensing, and
intended-use notes.

## Setup

Run commands through mise from any directory in the repository:

```bash
mise run //ml-pipelines/wsi-analysis:sync
mise run //ml-pipelines/wsi-analysis:pull
mise run //ml-pipelines/wsi-analysis:validate
```

`uv.lock` pins the environment. Ruff formats and lints the code, and `ty`
checks types. Run all checks with:

```bash
mise run //ml-pipelines/wsi-analysis:check
```

The `wsi-analysis` command uses Python Fire. Its public commands are
`inventory`, `validate`, and `tile`; application settings are not exposed as
CLI members.

The shared `dev_ml_pipelines` Doppler config supplies
`R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. The repository wrapper maps them
to the `AWS_*` variables expected by DVC's S3 transport. Credentials never
belong in `.dvc/config`, `.env`, command arguments, or Git.

## Data layout

```text
data/
├── wsi/    # source DICOM slide microscopy files
└── tiles/  # derived native OpenSlide levels and web-map pyramid tiles
```

`data/wsi.dvc` tracks the source files. [`dvc.yaml`](dvc.yaml) defines the
tiling stage, and `dvc.lock` pins the source, code, parameters, environment,
and derived-tile hashes. R2 stores the content-addressed DVC objects under
`s3://dvc/wsi-analysis`.

[`params.yaml`](params.yaml) selects the slide and output directory and sets
the tile and batch sizes. The stage extracts the native OpenSlide levels and
builds the web pyramid from level 0 without absolute links.

## Common tasks

```bash
# Show local and remote DVC state
mise run //ml-pipelines/wsi-analysis:dvc -- status
mise run //ml-pipelines/wsi-analysis:status:remote

# Build a stable JSON inventory or fully decode-check every PNG
mise run //ml-pipelines/wsi-analysis:inventory
mise run //ml-pipelines/wsi-analysis:validate

# Reproduce derived tiles, then upload the source and output cache to R2
mise run //ml-pipelines/wsi-analysis:repro
mise run //ml-pipelines/wsi-analysis:push

# Extract OpenSlide levels from an ad hoc WSI. Existing tiles are left untouched.
mise run //ml-pipelines/wsi-analysis:run -- \
  tile path/to/slide.dcm data/tiles/new-slide
```

Set `WSI_TILE_SIZE`, `WSI_BATCH_SIZE`, or `WSI_WORKERS` to tune extraction.
All settings use the `WSI_` prefix and Pydantic validates them before work
starts. Extraction writes each PNG through a temporary file and propagates
worker failures, so a partial run cannot masquerade as a successful one.

## Updating the dataset

1. Confirm the source and license, then update `dataset.json` if either changes.
2. Put source slides under `data/wsi` and run DVC add for that directory.
3. Update `params.yaml` when the selected slide or tiling parameters change.
4. Run the reproduction and validation tasks.
5. Push before committing the updated `data/wsi.dvc` and `dvc.lock` files.
6. Run the remote-status task. It should report that the cache and remote are
   in sync.

Do not publish the R2 bucket or reuse the separate `map-tiles` bucket as a DVC
remote. The DVC bucket should stay private and its token should have access to
that bucket only.
