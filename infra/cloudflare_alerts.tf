locals {
  slack_webhook_parts = regex("^(?P<base>https://hooks\\.slack\\.com/services/[^/]+/[^/]+)/(?P<secret>[^/]+)$", var.slack_webhook_url)
}

resource "cloudflare_notification_policy_webhooks" "slack_production_alerts" {
  account_id = var.cloudflare_account_id
  name       = "Slack #production-alerts"
  url        = local.slack_webhook_parts.base
  secret     = local.slack_webhook_parts.secret
}

resource "cloudflare_notification_policy" "pages_deployments" {
  account_id  = var.cloudflare_account_id
  name        = "Pages deployment failures"
  description = "Failed production Pages deployments"
  enabled     = true
  alert_type  = "pages_event_alert"

  filters {
    project_id  = ["54cc1492-569c-4072-a77b-47520974c731"]
    environment = ["ENVIRONMENT_PRODUCTION"]
    event       = ["EVENT_DEPLOYMENT_FAILED"]
  }

  webhooks_integration {
    id   = replace(cloudflare_notification_policy_webhooks.slack_production_alerts.id, "-", "")
    name = cloudflare_notification_policy_webhooks.slack_production_alerts.name
  }
}

resource "cloudflare_notification_policy" "cloudflare_incidents" {
  account_id  = var.cloudflare_account_id
  name        = "Cloudflare incidents affecting our services"
  description = "Major or critical Cloudflare incidents affecting Pages, Workers, R2, SSL, or DNS"
  enabled     = true
  alert_type  = "incident_alert"

  filters {
    affected_components = ["Pages", "Workers", "R2", "SSL Certificate Provisioning", "Authoritative DNS"]
    incident_impact     = ["INCIDENT_IMPACT_MAJOR", "INCIDENT_IMPACT_CRITICAL"]
  }

  webhooks_integration {
    id   = replace(cloudflare_notification_policy_webhooks.slack_production_alerts.id, "-", "")
    name = cloudflare_notification_policy_webhooks.slack_production_alerts.name
  }
}

resource "cloudflare_notification_policy" "expiring_service_tokens" {
  account_id  = var.cloudflare_account_id
  name        = "Access service token expiring"
  description = "Service token expires within 7 days"
  enabled     = true
  alert_type  = "expiring_service_token_alert"

  webhooks_integration {
    id   = replace(cloudflare_notification_policy_webhooks.slack_production_alerts.id, "-", "")
    name = cloudflare_notification_policy_webhooks.slack_production_alerts.name
  }
}

resource "cloudflare_notification_policy" "universal_ssl_events" {
  account_id  = var.cloudflare_account_id
  name        = "Universal SSL certificate events"
  description = "Universal certificate validation, issuance, renewal, and expiration notices"
  enabled     = true
  alert_type  = "universal_ssl_event_type"

  webhooks_integration {
    id   = replace(cloudflare_notification_policy_webhooks.slack_production_alerts.id, "-", "")
    name = cloudflare_notification_policy_webhooks.slack_production_alerts.name
  }
}

resource "cloudflare_notification_policy" "r2_usage" {
  account_id  = var.cloudflare_account_id
  name        = "R2 storage usage threshold"
  description = "R2 billing usage exceeds the configured threshold"
  enabled     = true
  alert_type  = "billing_usage_alert"

  filters {
    product = ["r2_storage"]
    limit   = ["50"]
  }

  webhooks_integration {
    id   = replace(cloudflare_notification_policy_webhooks.slack_production_alerts.id, "-", "")
    name = cloudflare_notification_policy_webhooks.slack_production_alerts.name
  }
}
