# Infrastructure

Terraform configuration for managing Cloudflare and Neon resources.

## GitHub Actions Setup

### Required Secrets

Configure these in GitHub repository settings (Settings → Secrets and variables → Actions):

1. **`CLOUDFLARE_API_TOKEN`**
   - Create at: Cloudflare Dashboard → My Profile → API Tokens
   - Required permissions:
     - Account.Cloudflare Pages: Edit
     - Account.Account Settings: Read
     - Zone.DNS: Edit (for domain management)
2. **`TF_API_TOKEN`**
   - Create at: Terraform Cloud → User Settings → Tokens
   - Used for remote state management
   - Note: Stored as `TF_API_TOKEN` in GitHub, but workflows map it to `TF_TOKEN_app_terraform_io` for Terraform CLI
3. **`CF_IMAGES_ACCOUNT_HASH`**
   - Find at: Cloudflare Dashboard → Images → Delivery URL
   - Example: `AbCdEfGh123` (from `https://imagedelivery.net/AbCdEfGh123/...`)
   - Used to configure Cloudflare Images environment variable for deployments
   - Note: Not actually sensitive (publicly visible in image URLs), but stored as secret for consistency
4. **`NEON_API_KEY`**
   - Create at: [Neon Console](https://console.neon.tech) → Account Settings → API Keys
   - Used by the Neon Terraform provider to manage database resources
5. **`NEON_ORG_ID`**
   - Find at: [Neon Console](https://console.neon.tech) → Organization settings
   - Passed as `TF_VAR_neon_org_id`

### Required Environment

Create a GitHub environment named `cloudflare-production`:

1. Go to: Settings → Environments → New environment
2. Name: `cloudflare-production`
3. (Optional) Add protection rules for production deployments

PR infrastructure uses a separate `cloudflare-preview` environment with
least-privilege credentials. Follow the
[preview environment runbook](../docs/preview-environments.md); do not copy the
production Cloudflare token or production database URL into it.

### Terraform Cloud Workspace

Create a workspace in Terraform Cloud for remote state:

1. Go to: [Terraform Cloud workspaces](https://app.terraform.io/app/robbie-palmer/workspaces)
2. Create a new workspace named: `personal-site`
3. Choose "API-driven workflow"

## Local Development

1. Create your local `.env` file:

   ```bash
   cp .env.example .env
   ```

2. Fill in your credentials in `.env`:
   - `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token
   - `TF_TOKEN_app_terraform_io` - Your Terraform Cloud token
   - `NEON_API_KEY` - Your Neon API key
   - `TF_VAR_neon_org_id` - Your Neon organization ID

3. Run Terraform commands via mise:
   - `mise run //infra:plan` - Preview changes
   - `mise run //infra:apply` - Apply changes

The `.env` file is automatically loaded by mise when running tasks.

See `mise.toml` for all available tasks.

## R2 Buckets

### `map-tiles`

Public bucket serving map tile images via `tiles.robbiepalmer.me`.
Has DNS records, cache rules, and proxied access configured in Terraform.

### `dvc`

Private bucket for ML pipeline data versioned with [DVC](https://dvc.org/).
Accessed only via S3-compatible API with credentials — no public access.
Used by `ml-pipelines/` projects, each under their own prefix
(e.g. `s3://dvc/recipe-parsing`).

To create an API token for access:
[Cloudflare R2](https://dash.cloudflare.com/?to=/:account/r2/overview) →
Manage R2 API Tokens → Create User API Token
(Object Read & Write, scoped to `dvc` bucket).

See [`ml-pipelines/README.md`](/ml-pipelines/README.md) for developer setup.

## Neon Database

### `recipes`

Serverless Postgres project for the recipe site. Managed via the
[kislerdm/neon](https://registry.terraform.io/providers/kislerdm/neon/latest/docs)
Terraform provider.

- **Region:** `aws-us-east-1`
- **Connection:** Use the pooled connection URI (`neon_connection_uri_pooler` output)
  for serverless/Workers environments
