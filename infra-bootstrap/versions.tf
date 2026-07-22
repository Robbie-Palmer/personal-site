terraform {
  required_version = ">= 1.14"

  cloud {
    organization = "robbie-palmer"
    workspaces {
      name = "personal-site-bootstrap"
    }
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
  # Credentials: `gcloud auth login --update-adc` locally; in CI, GitHub OIDC /
  # Workload Identity Federation creates GOOGLE_APPLICATION_CREDENTIALS. Runs
  # execute on the runner, not in TFC - see README.md.
}
