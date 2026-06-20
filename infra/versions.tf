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
  }
}

provider "cloudflare" {
  # API token should be provided via CLOUDFLARE_API_TOKEN environment variable
}

provider "neon" {
  # API key should be provided via NEON_API_KEY environment variable
}
