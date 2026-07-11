output "gcp_terraform_service_account_email" {
  description = "Service account GitHub Actions impersonates to run privileged GCP Terraform"
  value       = google_service_account.github_terraform.email
}

output "gcp_workload_identity_provider" {
  description = "Workload Identity Provider resource name for google-github-actions/auth"
  value       = "projects/${google_project.recipes.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github_actions.workload_identity_pool_id}/providers/${google_iam_workload_identity_pool_provider.bootstrap.workload_identity_pool_provider_id}"
}
