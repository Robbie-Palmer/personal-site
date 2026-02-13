# ML Pipelines

ML projects in this directory use [DVC](https://dvc.org/) to version data,
with a shared private Cloudflare R2 bucket (`dvc`) as remote storage.
Each project stores data under its own prefix (e.g. `s3://dvc/recipe-parsing`).

## Prerequisites

Install DVC with S3 support:

```bash
pip install 'dvc[s3]'
```

## Credentials Setup

You need an R2 API token to push and pull data.
Go to [Cloudflare R2](https://dash.cloudflare.com/?to=/:account/r2/overview) →
Manage R2 API Tokens to create one.

**For local development** — Create a **User API Token**:

1. Permissions: **Object Read & Write**
2. Specify bucket: `dvc`
3. Save the **Access Key ID** and **Secret Access Key**

**For CI (GitHub Actions)** — Create an **Account API Token**:

1. Permissions: **Object Read**
2. Specify bucket: `dvc`
3. Add the credentials as `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` secrets in the `cloudflare-production` GitHub environment

**Configure local credentials:**

Copy the `.env.example` in this directory and fill in your values:

```bash
cp .env.example .env
```

The `.env` file is loaded by mise. Run DVC commands via `mise x --`
so the environment is available:

```bash
mise x -- dvc pull
mise x -- dvc push
```

`.env` is git-ignored.

Note: The R2 endpoint URL is hardcoded in each project's `.dvc/config`
since DVC doesn't support environment variable substitution in config files.

## Common DVC Workflows

Run all commands from within a project directory.

### Pull data

After cloning or checking out a branch:

```bash
mise x -- dvc pull
```

### Add new data

```bash
# Track new files with DVC
mise x -- dvc add data/my-dataset

# Commit the .dvc tracking file (autostage is enabled, so it's already staged)
git commit -m "Add dataset"

# Push data to R2
mise x -- dvc push
```
