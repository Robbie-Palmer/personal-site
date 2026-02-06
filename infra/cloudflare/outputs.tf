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
