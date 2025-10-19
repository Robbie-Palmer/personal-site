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
