# PostHog log alerts.
#
# Error responses and thrown failures are recorded on spans and emitted as
# correlated ERROR logs by packages/observability. Alerting on those logs
# therefore covers the operational failures visible in both Logs and Traces.
#
# Thresholds were simulated against the seven days ending 2026-07-29:
# - recipe-api: one fire for sustained errors
# - recipe-ingest: one fire for an ingestion failure
# - recipe-pages: no fires

locals {
  posthog_log_alert_collection_path = "/api/projects/${var.posthog_project_id}/logs/alerts/"
  posthog_log_alert_item_path       = "${local.posthog_log_alert_collection_path}{id}/"

  posthog_log_alerts = {
    recipe_api_sustained_errors = {
      name                = "Recipe API sustained errors"
      service_names       = ["recipe-api"]
      threshold_count     = 5
      evaluation_periods  = 3
      datapoints_to_alarm = 2
      cooldown_minutes    = 30
    }
    recipe_ingest_errors = {
      name                = "Recipe ingestion errors"
      service_names       = ["recipe-ingest"]
      threshold_count     = 0
      evaluation_periods  = 1
      datapoints_to_alarm = 1
      cooldown_minutes    = 30
    }
    recipe_pages_errors = {
      name                = "Recipe Pages errors"
      service_names       = ["recipe-pages"]
      threshold_count     = 0
      evaluation_periods  = 1
      datapoints_to_alarm = 1
      cooldown_minutes    = 30
    }
  }
}

resource "restapi_object" "posthog_log_alert" {
  for_each = local.posthog_log_alerts

  path         = local.posthog_log_alert_collection_path
  read_path    = local.posthog_log_alert_item_path
  update_path  = local.posthog_log_alert_item_path
  destroy_path = local.posthog_log_alert_item_path
  id_attribute = "id"
  data = jsonencode({
    name    = each.value.name
    enabled = true
    filters = {
      severityLevels = ["error", "fatal"]
      serviceNames   = each.value.service_names
    }
    threshold_count     = each.value.threshold_count
    threshold_operator  = "above"
    window_minutes      = 5
    evaluation_periods  = each.value.evaluation_periods
    datapoints_to_alarm = each.value.datapoints_to_alarm
    cooldown_minutes    = each.value.cooldown_minutes
  })

  # PostHog returns scheduling, state, history, and creator metadata alongside
  # the managed definition. Ignore only those server-added fields while still
  # detecting drift in every configured alert field.
  ignore_server_additions = true

  lifecycle {
    prevent_destroy = true
  }
}
