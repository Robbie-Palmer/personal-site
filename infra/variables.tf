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
}

variable "cf_pages_host" {
  description = "Cloudflare Pages project hostname used to recognize canonical PR aliases"
  type        = string
  default     = "personal-site-bu5.pages.dev"
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
