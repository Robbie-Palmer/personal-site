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

**Configure local credentials** using one of these methods:

### Option A: Environment Variables (recommended)

Add to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
export AWS_ACCESS_KEY_ID='your-access-key-id'
export AWS_SECRET_ACCESS_KEY='your-secret-access-key'
```

### Option B: Local DVC Config

Run from within a project directory:

```bash
dvc remote modify --local r2 access_key_id 'your-access-key-id'
dvc remote modify --local r2 secret_access_key 'your-secret-access-key'
```

This creates `.dvc/config.local` which is git-ignored.

## Common DVC Workflows

### Pull data

After cloning or checking out a branch, run from within a project directory:

```bash
dvc pull
```

### Add new data

```bash
# Track new files with DVC
dvc add data/my-dataset

# Commit the .dvc tracking file (autostage is enabled, so it's already staged)
git commit -m "Add dataset"

# Push data to R2
dvc push
```
