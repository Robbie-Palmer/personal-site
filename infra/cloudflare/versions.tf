terraform {
  required_version = ">= 1.13"

  cloud {
    organization = "robbie-palmer"
    workspaces {
      name = "personal-site"
    }
  }

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 5.11, < 6"
    }
  }
}

provider "cloudflare" {
  # API token should be provided via CLOUDFLARE_API_TOKEN environment variable
}
