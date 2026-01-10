data "cloudflare_zone" "domain" {
  name = var.domain_name
}

resource "cloudflare_pages_project" "personal_site" {
  account_id        = var.cloudflare_account_id
  name              = var.project_name
  production_branch = var.production_branch

  build_config {
    build_command   = "curl https://mise.run | sh && export PATH=\"$HOME/.local/bin:$PATH\" && MISE_EXPERIMENTAL=1 mise run //ui:build"
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
      environment_variables = {
        NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = var.cf_images_account_hash
      }
    }

    preview {
      environment_variables = {
        NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = var.cf_images_account_hash
      }
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

resource "cloudflare_pages_domain" "robbiepalmer_me_assettracker" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.personal_site.name
  domain       = "assettracker.${var.domain_name}"
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

resource "cloudflare_record" "robbiepalmer_me_assettracker" {
  zone_id = data.cloudflare_zone.domain.id
  name    = "assettracker"
  content = cloudflare_pages_project.personal_site.subdomain
  type    = "CNAME"
  ttl     = 1 # Auto when proxied
  proxied = true
}
