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

# Neon

output "neon_project_id" {
  description = "Neon project ID"
  value       = neon_project.recipes.id
}

output "neon_connection_uri_pooler" {
  description = "Neon pooled connection URI (for serverless/Workers)"
  value       = neon_project.recipes.connection_uri_pooler
  sensitive   = true
}

output "neon_database_host_pooler" {
  description = "Neon pooler endpoint hostname"
  value       = neon_project.recipes.database_host_pooler
}

output "neon_database_name" {
  description = "Neon database name"
  value       = neon_project.recipes.database_name
}
