# PostHog product analytics-as-code.
#
# The resource inventory is generated from the live PostHog project in
# posthog_resources.json so Terraform can import and then own the existing
# dashboards and insights instead of creating starter examples.

locals {
  posthog_resources  = jsondecode(file("${path.module}/posthog_resources.json"))
  posthog_dashboards = local.posthog_resources.dashboards
  posthog_insights   = local.posthog_resources.insights
}

resource "posthog_dashboard" "managed" {
  for_each = local.posthog_dashboards

  name        = each.value.name
  description = try(each.value.description, null)
  pinned      = each.value.pinned
  tags        = length(try(each.value.tags, [])) > 0 ? toset(each.value.tags) : null
}

resource "posthog_insight" "managed" {
  for_each = local.posthog_insights

  name        = try(each.value.name, null)
  description = try(each.value.description, null)
  dashboard_ids = length(try(each.value.dashboard_keys, [])) > 0 ? toset([
    for dashboard_key in each.value.dashboard_keys :
    posthog_dashboard.managed[dashboard_key].id
  ]) : null
  tags       = length(try(each.value.tags, [])) > 0 ? toset(each.value.tags) : null
  query_json = jsonencode(each.value.query)
}

import {
  for_each = local.posthog_dashboards

  to = posthog_dashboard.managed[each.key]
  id = "${var.posthog_project_id}/${each.value.id}"
}

import {
  for_each = local.posthog_insights

  to = posthog_insight.managed[each.key]
  id = "${var.posthog_project_id}/${each.value.id}"
}
