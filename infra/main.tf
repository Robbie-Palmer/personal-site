data "cloudflare_zone" "domain" {
  name = var.domain_name
}

locals {
  pages_environment_variables = {
    NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = var.cf_images_account_hash
    NEXT_PUBLIC_POSTHOG_KEY            = var.posthog_key
    NEXT_PUBLIC_POSTHOG_HOST           = var.posthog_host
    GITHUB_TOKEN                       = var.github_token
    RECIPE_API_URL                     = var.recipe_api_url
    RECIPE_API_PREVIEW_ORIGIN_TEMPLATE = var.recipe_api_preview_origin_template
    CF_PAGES_HOST                      = var.cf_pages_host
  }
}

resource "cloudflare_pages_project" "personal_site" {
  account_id        = var.cloudflare_account_id
  name              = var.project_name
  production_branch = var.production_branch

  build_config {
    build_caching   = true
    build_command   = "curl https://mise.run | sh && export PATH=\"$HOME/.local/bin:$PATH\" && MISE_IGNORED_CONFIG_PATHS=\"$HOME/.tool-versions\" MISE_EXPERIMENTAL=1 MISE_DISABLE_TOOLS=terraform MISE_YES=1 mise run //ui:build"
    destination_dir = "ui/out"
    root_dir        = ""
  }

  source {
    type = "github"
    config {
      owner                         = var.github_repo_owner
      repo_name                     = var.github_repo_name
      production_branch             = var.production_branch
      pr_comments_enabled           = false
      deployments_enabled           = false
      production_deployment_enabled = false
      preview_deployment_setting    = "none"
      preview_branch_includes       = []
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

resource "cloudflare_r2_bucket" "dvc" {
  account_id = var.cloudflare_account_id
  name       = var.r2_dvc_bucket_name
  location   = "ENAM"
}

# Neon

resource "neon_project" "recipes" {
  name       = "recipes"
  region_id  = var.neon_region
  pg_version = var.neon_pg_version
  org_id     = var.neon_org_id

  history_retention_seconds = 21600 # 6 hours (free plan max)

  lifecycle {
    prevent_destroy = true
  }

  branch {
    name          = "main"
    database_name = "recipes"
    role_name     = "recipes_owner"
  }

  quota {
    compute_time_seconds = 360000     # 100 CU-hours (free plan limit)
    data_transfer_bytes  = 5368709120 # 5 GB (free plan limit)
    logical_size_bytes   = 536870912  # 512 MB per branch (free plan limit)
  }
}

# Hyperdrive — connection pooling from Workers to Neon.
# Uses the direct host (not pooler) because Hyperdrive does its own pooling.

resource "cloudflare_hyperdrive_config" "recipe_db" {
  account_id = var.cloudflare_account_id
  name       = "recipe-db"

  origin = {
    database = neon_project.recipes.database_name
    host     = neon_project.recipes.database_host
    port     = 5432
    user     = neon_project.recipes.database_user
    password = neon_project.recipes.database_password
    scheme   = "postgresql"
  }

  caching = {
    disabled = true
  }
}

# Cloudflare cache

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

# Edge rate limiting — broad per-IP protection for the auth endpoints, the
# outermost tier of the layered design in ADR 035. Auth traffic reaches the
# Worker through robbiepalmer.me/api/auth/* (the Pages Function proxy), so the
# zone sees the real client IP here, before the request ever hits the Worker.
# Application-specific and per-account limits live in the Worker itself.
resource "cloudflare_ruleset" "auth_rate_limit" {
  zone_id     = data.cloudflare_zone.domain.id
  name        = "Auth endpoint rate limiting"
  description = "Per-IP rate limiting for /api/auth/* — returns 429 on abuse"
  kind        = "zone"
  phase       = "http_ratelimit"

  rules {
    ref         = "auth_ip_rate_limit"
    description = "Limit auth requests per IP"
    expression  = "(http.host eq \"${var.domain_name}\" and starts_with(http.request.uri.path, \"/api/auth/\"))"
    # Blocking in the http_ratelimit phase responds with HTTP 429.
    action = "block"

    ratelimit {
      characteristics     = ["ip.src"]
      period              = var.auth_rate_limit_period
      requests_per_period = var.auth_rate_limit_requests
      mitigation_timeout  = var.auth_rate_limit_mitigation_timeout
    }
  }
}
