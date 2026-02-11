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
}

variable "posthog_host" {
  description = "PostHog host URL"
  type        = string
  default     = "https://eu.posthog.com"
}
