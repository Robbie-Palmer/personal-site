variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "project_name" {
  description = "Name of the Cloudflare Pages project"
  type        = string
  default     = "personal-site"
}

variable "production_branch" {
  description = "Git branch for production deployments"
  type        = string
  default     = "main"
}

variable "github_repo_owner" {
  description = "GitHub repository owner/organization"
  type        = string
}

variable "github_repo_name" {
  description = "GitHub repository name"
  type        = string
}

variable "domain_name" {
  description = "The domain name for the personal site"
  type        = string
  default     = "robbiepalmer.me"
}

variable "cf_images_account_hash" {
  description = "Cloudflare Images account hash"
  type        = string
}

variable "r2_map_tiles_bucket_name" {
  description = "Name of the R2 bucket for map tiles"
  type        = string
  default     = "map-tiles"
}

variable "r2_map_tiles_subdomain" {
  description = "Subdomain for serving map tiles (e.g. 'tiles' for tiles.robbiepalmer.me)"
  type        = string
  default     = "tiles"
}

variable "posthog_key" {
  description = "PostHog project API key"
  type        = string
  sensitive   = true
}

variable "github_token" {
  description = "GitHub personal access token for mise tool downloads in Cloudflare Pages builds"
  type        = string
  sensitive   = true
}

variable "posthog_host" {
  description = "PostHog host URL"
  type        = string
  default     = "https://eu.posthog.com"
}

variable "posthog_project_id" {
  description = "PostHog project/environment ID used by the Terraform provider"
  type        = string
  nullable    = false

  validation {
    condition     = length(trimspace(var.posthog_project_id)) > 0
    error_message = "posthog_project_id must be provided via TF_VAR_posthog_project_id or POSTHOG_PROJECT_ID."
  }
}

variable "r2_dvc_bucket_name" {
  description = "Name of the R2 bucket for DVC data storage"
  type        = string
  default     = "dvc"
}

variable "recipe_api_url" {
  description = "URL of the recipe-api Worker for the auth proxy"
  type        = string
  default     = "https://recipe-api.robbiepalmer95.workers.dev"
}

variable "recipe_api_preview_origin_template" {
  description = "Preview Worker origin template; {pr} is replaced with the PR number"
  type        = string
  default     = "https://recipe-api-pr-{pr}.robbiepalmer95.workers.dev"

  validation {
    condition = (
      length(regexall("\\{pr\\}", var.recipe_api_preview_origin_template)) == 1 &&
      can(regex("^https://[A-Za-z0-9.-]*\\{pr\\}[A-Za-z0-9.-]*(:[0-9]+)?$", var.recipe_api_preview_origin_template))
    )
    error_message = "recipe_api_preview_origin_template must be an HTTPS origin template containing exactly one {pr} placeholder and no path or query."
  }
}

variable "cf_pages_host" {
  description = "Cloudflare Pages project hostname used to recognize canonical PR aliases"
  type        = string
  default     = "personal-site-bu5.pages.dev"

  validation {
    condition = (
      can(regex("^[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z0-9]$", var.cf_pages_host)) &&
      length(regexall("\\.", var.cf_pages_host)) > 0 &&
      length(regexall("\\.\\.", var.cf_pages_host)) == 0
    )
    error_message = "cf_pages_host must be a hostname only, with no scheme, path, query, or empty labels."
  }
}

variable "auth_rate_limit_requests" {
  description = "Max auth requests per IP within the counting period before the edge returns 429"
  type        = number
  default     = 20

  validation {
    condition     = var.auth_rate_limit_requests > 0
    error_message = "auth_rate_limit_requests must be greater than zero."
  }
}

variable "auth_rate_limit_period" {
  description = "Counting period in seconds for edge auth rate limiting"
  type        = number
  default     = 10

  validation {
    condition     = contains([10, 60, 120, 300, 600, 3600], var.auth_rate_limit_period)
    error_message = "auth_rate_limit_period must be one of 10, 60, 120, 300, 600, 3600 seconds."
  }
}

variable "auth_rate_limit_mitigation_timeout" {
  description = "Seconds to keep blocking an IP after it trips the auth rate limit (must be >= the period)"
  type        = number
  default     = 10

  validation {
    condition     = var.auth_rate_limit_mitigation_timeout >= 10
    error_message = "auth_rate_limit_mitigation_timeout must be at least 10 seconds."
  }
}

# Google Cloud

variable "gcp_project_id" {
  description = "GCP project ID backing the recipe site's Google OAuth"
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.gcp_project_id))
    error_message = "gcp_project_id must be 6 to 30 characters long, start with a lowercase letter, end with a lowercase letter or number, and contain only lowercase letters, numbers, and hyphens."
  }
}

variable "gcp_project_name" {
  description = "Display name of the GCP project (mutable; must match the existing project on import)"
  type        = string
  default     = "recipe-site"
}

variable "gcp_region" {
  description = "Default region for GCP resources"
  type        = string
  default     = "us-east1"

  validation {
    condition     = can(regex("^[a-z]+-[a-z0-9]+[0-9]$", var.gcp_region))
    error_message = "gcp_region must be a valid GCP region name (e.g., us-east1)."
  }
}

variable "gcp_terraform_service_account_id" {
  description = "Account ID for the service account GitHub Actions impersonates to run Terraform"
  type        = string
  default     = "github-terraform"
}

variable "gcp_github_workload_identity_pool_id" {
  description = "Workload Identity Pool ID for GitHub Actions"
  type        = string
  default     = "github-actions"
}

variable "gcp_github_workload_identity_provider_id" {
  description = "Workload Identity Pool Provider ID for this repository"
  type        = string
  default     = "personal-site"
}

variable "gcp_terraform_service_account_roles" {
  description = "Project-level roles granted to the GitHub Actions Terraform service account"
  type        = set(string)
  default = [
    "roles/browser",
    "roles/iam.serviceAccountAdmin",
    "roles/iam.workloadIdentityPoolAdmin",
    "roles/resourcemanager.projectIamAdmin",
    "roles/serviceusage.serviceUsageAdmin",
  ]
}

# Neon

variable "neon_org_id" {
  description = "Neon organization ID"
  type        = string
}

variable "neon_region" {
  description = "Neon deployment region"
  type        = string
  default     = "aws-us-east-1"
}

variable "neon_pg_version" {
  description = "Postgres version for Neon project"
  type        = number
  default     = 17
}
