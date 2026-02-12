data "cloudflare_zone" "domain" {
  name = var.domain_name
}

locals {
  pages_environment_variables = {
    NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = var.cf_images_account_hash
    NEXT_PUBLIC_POSTHOG_KEY            = var.posthog_key
    NEXT_PUBLIC_POSTHOG_HOST           = var.posthog_host
  }
}

resource "cloudflare_pages_project" "personal_site" {
  account_id        = var.cloudflare_account_id
  name              = var.project_name
  production_branch = var.production_branch

  build_config {
    build_caching   = true
    build_command   = "curl https://mise.run | sh && export PATH=\"$HOME/.local/bin:$PATH\" && MISE_IGNORED_CONFIG_PATHS=~/.tool-versions MISE_EXPERIMENTAL=1 mise run //ui:build"
    destination_dir = "ui/out"
    root_dir        = ""
  }

  source {
    type = "github"
    config {
      owner                         = var.github_repo_owner
      repo_name                     = var.github_repo_name
      production_branch             = var.production_branch
      pr_comments_enabled           = true
      deployments_enabled           = true
      production_deployment_enabled = true
      preview_deployment_setting    = "all"
      preview_branch_includes       = ["*"]
      preview_branch_excludes       = []
    }
  }

  deployment_configs {
    production {
      environment_variables = local.pages_environment_variables
    }

    preview {
      environment_variables = local.pages_environment_variables
    }
  }
}

resource "cloudflare_pages_domain" "robbiepalmer_me" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.personal_site.name
  domain       = var.domain_name
}

resource "cloudflare_pages_domain" "robbiepalmer_me_www" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.personal_site.name
  domain       = "www.${var.domain_name}"
}

resource "cloudflare_record" "robbiepalmer_me_apex" {
  zone_id = data.cloudflare_zone.domain.id
  name    = "@"
  content = cloudflare_pages_project.personal_site.subdomain
  type    = "CNAME"
  ttl     = 1 # Auto when proxied
  proxied = true
}

resource "cloudflare_record" "robbiepalmer_me_www" {
  zone_id = data.cloudflare_zone.domain.id
  name    = "www"
  content = cloudflare_pages_project.personal_site.subdomain
  type    = "CNAME"
  ttl     = 1 # Auto when proxied
  proxied = true
}

resource "cloudflare_r2_bucket" "map_tiles" {
  account_id = var.cloudflare_account_id
  name       = var.r2_map_tiles_bucket_name
  location   = "ENAM" # Eastern North America - closest to most users
}

resource "cloudflare_ruleset" "map_tiles_cache" {
  zone_id     = data.cloudflare_zone.domain.id
  name        = "Map tiles cache settings"
  description = "Aggressive caching for immutable map tile images"
  kind        = "zone"
  phase       = "http_request_cache_settings"

  rules {
    ref         = "map_tiles_edge_cache"
    description = "Cache map tiles at edge for 1 year"
    expression  = "(http.host eq \"${var.r2_map_tiles_subdomain}.${var.domain_name}\")"
    action      = "set_cache_settings"
    action_parameters {
      edge_ttl {
        mode    = "override_origin"
        default = 365 * 24 * 60 * 60 # 1 year in seconds  
      }
      browser_ttl {
        mode    = "override_origin"
        default = 24 * 60 * 60 # 1 day - allows cache busting if tiles are re-generated  
      }
    }
  }
}

