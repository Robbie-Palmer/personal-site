output "pages_project_name" {
  description = "Name of the Cloudflare Pages project"
  value       = cloudflare_pages_project.personal_site.name
}

output "pages_project_subdomain" {
  description = "Subdomain of the Cloudflare Pages project"
  value       = cloudflare_pages_project.personal_site.subdomain
}

output "pages_project_domains" {
  description = "Domains associated with the Cloudflare Pages project"
  value       = cloudflare_pages_project.personal_site.domains
}

output "r2_map_tiles_bucket_name" {
  description = "Name of the R2 bucket for map tiles"
  value       = cloudflare_r2_bucket.map_tiles.name
}

output "r2_map_tiles_url" {
  description = "URL where map tiles will be served (requires custom domain setup)"
  value       = "https://${var.r2_map_tiles_subdomain}.${var.domain_name}"
}

output "r2_dvc_bucket_name" {
  description = "Name of the R2 bucket for DVC storage"
  value       = cloudflare_r2_bucket.dvc.name
}

output "r2_dvc_endpoint_url" {
  description = "S3-compatible endpoint URL for DVC storage"
  value       = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com"
}

output "r2_recipe_artifacts_bucket_name" {
  description = "Name of the R2 bucket for recipe ingestion artifacts"
  value       = cloudflare_r2_bucket.recipe_artifacts.name
}

output "r2_recipe_artifacts_preview_bucket_name" {
  description = "Name of the shared bucket for recipe ingestion preview artifacts"
  value       = cloudflare_r2_bucket.recipe_artifacts_preview.name
}

output "r2_database_backups_bucket_name" {
  description = "Name of the private bucket for encrypted PostgreSQL backups"
  value       = cloudflare_r2_bucket.database_backups.name
}

# Neon

output "neon_project_id" {
  description = "Neon project ID"
  value       = neon_project.recipes.id
}

output "neon_database_host_pooler" {
  description = "Neon pooler endpoint hostname"
  value       = neon_project.recipes.database_host_pooler
}

output "neon_database_name" {
  description = "Neon database name"
  value       = neon_project.recipes.database_name
}

# Hyperdrive

output "hyperdrive_config_id" {
  description = "Hyperdrive configuration ID for recipe-db (set in wrangler.toml)"
  value       = cloudflare_hyperdrive_config.recipe_db.id
}
