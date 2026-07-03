terraform {
  required_version = ">= 1.14"

  cloud {
    organization = "robbie-palmer"
    workspaces {
      name = "personal-site"
    }
  }

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.13"
    }
    posthog = {
      source  = "PostHog/posthog"
      version = "~> 1.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "cloudflare" {
  # API token should be provided via CLOUDFLARE_API_TOKEN environment variable
}

provider "neon" {
  # API key should be provided via NEON_API_KEY environment variable
}

provider "posthog" {
  host       = var.posthog_host
  project_id = var.posthog_project_id
  # API key should be provided via POSTHOG_API_KEY.
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
  # Credentials: `gcloud auth login --update-adc` locally; in CI, GitHub OIDC /
  # Workload Identity Federation creates GOOGLE_APPLICATION_CREDENTIALS. Runs
  # execute on the runner, not in TFC - see infra/README.md.
}
