# ML Pipelines

ML projects in this directory use [DVC](https://dvc.org/) to version data,
with a shared private Cloudflare R2 bucket (`dvc`) as remote storage.
Each project stores data under its own prefix (e.g. `s3://dvc/recipe-parsing`).

Current projects:

- `recipe-parsing`: image extraction, normalization, canonicalization, and
  evaluation.
- `recipe-dataset`: acquisition and preparation of reusable recipe text
  corpora for site seeding and future parsing evaluation.

## Prerequisites

DVC is supplied by mise through `uv`, so no manual install is needed. The
`dvc` task and its wrappers below resolve it on first use.

You do need the [Doppler CLI](https://docs.doppler.com/docs/install-cli)
installed and authenticated, since it injects the credentials.

## Credentials Setup

Secrets come from the Doppler config `dev_ml_pipelines`, injected by
`scripts/doppler-pipeline-env`. It holds:

- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — DVC remote access. The wrapper
  maps them to the `AWS_*` names DVC's S3 remote reads, matching how CI maps
  them.
- `OPENROUTER_API_KEY` — the LLM stages.

You need an R2 API token for the credentials themselves.
Go to [Cloudflare R2](https://dash.cloudflare.com/?to=/:account/r2/overview) →
Manage R2 API Tokens to create one.

**For local development** — Create a **User API Token**:

1. Permissions: **Object Read & Write**
2. Specify bucket: `dvc`
3. Put the **Access Key ID** and **Secret Access Key** into Doppler
   `dev_ml_pipelines`

**For CI (GitHub Actions)** — Create an **Account API Token**:

1. Permissions: **Object Read**
2. Specify bucket: `dvc`
3. Add the credentials to Doppler `prd_ci_repo`, then run
   `scripts/sync-doppler-github-envs.sh` to mirror them into the
   `production-ci` GitHub environment

Note: The R2 endpoint URL is hardcoded in each project's `.dvc/config`
since DVC doesn't support environment variable substitution in config files.

## Common DVC Workflows

Each project exposes its own tasks, so run them by project path from anywhere
in the repo.

### Pull data

After cloning or checking out a branch:

```bash
mise run //ml-pipelines/recipe-parsing:pull
```

### Reproduce a pipeline

```bash
mise run //ml-pipelines/recipe-parsing:repro
```

### Any other DVC command

Pass it through the `dvc` task:

```bash
mise run //ml-pipelines/recipe-parsing:dvc -- status
mise run //ml-pipelines/recipe-parsing:dvc -- add data/my-dataset
```

### Add new data

```bash
# Track new files with DVC
mise run //ml-pipelines/recipe-parsing:dvc -- add data/my-dataset

# Commit the .dvc tracking file (autostage is enabled, so it's already staged)
git commit -m "Add dataset"

# Push data to R2
mise run //ml-pipelines/recipe-parsing:push
```
