# Google Cloud - recipe site OAuth
#
# The OAuth consent screen and the OAuth 2.0 "Web application" client
# (client ID + secret) are configured manually in the Cloud console. Neither
# has a usable Terraform resource: the only options (google_iap_brand,
# google_iap_client) are IAP-only, built on a deprecated API, and cannot
# represent a general sign-in client. Those stay click-ops; Terraform manages
# the project and its enabled APIs around them.

resource "google_project" "recipes" {
  name       = var.gcp_project_name
  project_id = var.gcp_project_id

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      billing_account,
    ]
  }
}

import {
  to = google_project.recipes
  id = var.gcp_project_id
}

locals {
  github_repository = "${var.github_repo_owner}/${var.github_repo_name}"

  gcp_required_services = toset([
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "serviceusage.googleapis.com",
    "sts.googleapis.com",
  ])

  github_actions_principal = "principalSet://iam.googleapis.com/projects/${google_project.recipes.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github_actions.workload_identity_pool_id}/attribute.repository/${local.github_repository}"
}

resource "google_project_service" "required" {
  for_each = local.gcp_required_services

  project = google_project.recipes.project_id
  service = each.value

  disable_on_destroy = false
}

resource "google_service_account" "github_terraform" {
  project      = google_project.recipes.project_id
  account_id   = var.gcp_terraform_service_account_id
  display_name = "GitHub Actions Terraform"
  description  = "Impersonated by GitHub Actions via Workload Identity Federation to run Terraform."

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "github_terraform" {
  for_each = var.gcp_terraform_service_account_roles

  project = google_project.recipes.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.github_terraform.email}"
}

resource "google_iam_workload_identity_pool" "github_actions" {
  project                   = google_project.recipes.project_id
  workload_identity_pool_id = var.gcp_github_workload_identity_pool_id
  display_name              = "GitHub Actions"
  description               = "OIDC identities from GitHub Actions."
  disabled                  = false

  depends_on = [google_project_service.required]
}

resource "google_iam_workload_identity_pool_provider" "personal_site" {
  project                            = google_project.recipes.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_actions.workload_identity_pool_id
  workload_identity_pool_provider_id = var.gcp_github_workload_identity_provider_id
  display_name                       = "personal-site"
  description                        = "GitHub Actions OIDC provider for ${local.github_repository}."

  attribute_mapping = {
    "google.subject"        = "assertion.sub"
    "attribute.actor"       = "assertion.actor"
    "attribute.environment" = "assertion.environment"
    "attribute.repository"  = "assertion.repository"
    "attribute.ref"         = "assertion.ref"
  }

  attribute_condition = "assertion.repository == '${local.github_repository}' && assertion.environment == 'production-infra'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_actions_workload_identity_user" {
  service_account_id = google_service_account.github_terraform.name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.github_actions_principal
}
