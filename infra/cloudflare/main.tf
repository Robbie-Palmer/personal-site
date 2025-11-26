data "cloudflare_zone" "domain" {
  filter = {
    name = var.domain_name
  }
}

resource "cloudflare_pages_project" "personal_site" {
  account_id        = var.cloudflare_account_id
  name              = var.project_name
  production_branch = var.production_branch

  build_config = {
    build_caching   = true
    build_command   = "curl https://mise.run | sh && export PATH=\"$HOME/.local/bin:$PATH\" && MISE_EXPERIMENTAL=1 mise run //ui:build"
    destination_dir = "ui/out"
    root_dir        = ""
  }

  source = {
    type = "github"
    config = {
      owner                          = var.github_repo_owner
      repo_name                      = var.github_repo_name
      production_branch              = var.production_branch
      pr_comments_enabled            = true
      production_deployments_enabled = true
      preview_deployment_setting     = "all"
      preview_branch_includes        = ["*"]
      preview_branch_excludes        = []
    }
  }
}

resource "cloudflare_pages_domain" "robbiepalmer_me" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.personal_site.name
  name         = var.domain_name
}

resource "cloudflare_dns_record" "robbiepalmer_me_apex" {
  zone_id = data.cloudflare_zone.domain.zone_id
  name    = "@"
  content = cloudflare_pages_project.personal_site.subdomain
  type    = "CNAME"
  ttl     = 1 # Auto when proxied
  proxied = true
  comment = "Personal site on Cloudflare Pages"
}

resource "cloudflare_dns_record" "robbiepalmer_me_www" {
  zone_id = data.cloudflare_zone.domain.zone_id
  name    = "www"
  content = cloudflare_pages_project.personal_site.subdomain
  type    = "CNAME"
  ttl     = 1 # Auto when proxied
  proxied = true
  comment = "Personal site on Cloudflare Pages (www subdomain)"
}
