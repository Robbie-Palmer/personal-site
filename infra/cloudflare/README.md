# Cloudflare Infrastructure

Terraform configuration for managing Cloudflare Pages deployments.

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

### Required Environment

Create a GitHub environment named `cloudflare-production`:

1. Go to: Settings → Environments → New environment
2. Name: `cloudflare-production`
3. (Optional) Add protection rules for production deployments

### Terraform Cloud Workspace

Create a workspace in Terraform Cloud for remote state:

1. Go to: <https://app.terraform.io/app/robbie-palmer/workspaces>
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

3. Run Terraform commands via mise:
   - `mise run //infra/cloudflare:plan` - Preview changes
   - `mise run //infra/cloudflare:apply` - Apply changes

The `.env` file is automatically loaded by mise when running tasks.

See `mise.toml` for all available tasks.
