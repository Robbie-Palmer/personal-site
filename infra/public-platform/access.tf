# Cloudflare Pages creates the preview Access application when preview
# protection is enabled in the dashboard. Terraform owns the machine identity
# and its application-scoped policy after that one-time bootstrap.
resource "cloudflare_zero_trust_access_service_token" "preview_qa_agents" {
  account_id = var.cloudflare_account_id
  name       = "personal-site-preview-qa-agents"
  # Expiry renewal does not rotate the underlying secret. Keep the narrowly
  # scoped identity stable and rotate its secret independently with overlap.
  duration = "forever"

  lifecycle {
    create_before_destroy = true
  }
}

# Preview test requests pass through PR-controlled Pages Functions. Give the
# workflow a separate identity whose secret is rotated before and after every
# serialized run, so the long-lived coding-agent credential never reaches PR
# code.
resource "cloudflare_zero_trust_access_service_token" "preview_qa_workflow" {
  account_id = var.cloudflare_account_id
  name       = "personal-site-preview-qa-workflow"
  duration   = "forever"

  lifecycle {
    create_before_destroy = true
  }
}

resource "cloudflare_zero_trust_access_policy" "preview_qa_agents" {
  account_id     = var.cloudflare_account_id
  application_id = var.cloudflare_pages_preview_access_application_id
  name           = "Coding agents and preview QA"
  decision       = "non_identity"
  # The existing human allow policy is precedence 1.
  precedence = 2

  include {
    service_token = [
      cloudflare_zero_trust_access_service_token.preview_qa_agents.id,
      cloudflare_zero_trust_access_service_token.preview_qa_workflow.id,
    ]
  }
}
