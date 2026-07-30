# PostHog product analytics-as-code.
#
# The resource inventory is generated from the live PostHog project in
# posthog_resources.json so Terraform can import and then own the existing
# dashboards and insights instead of creating starter examples.

locals {
  posthog_existing_resources = jsondecode(file("${path.module}/posthog_resources.json"))
  posthog_plg_resources      = jsondecode(file("${path.module}/posthog_plg_resources.json"))

  posthog_dashboard_key_collisions = setintersection(
    toset(keys(local.posthog_existing_resources.dashboards)),
    toset(keys(local.posthog_plg_resources.dashboards)),
  )
  posthog_insight_key_collisions = setintersection(
    toset(keys(local.posthog_existing_resources.insights)),
    toset(keys(local.posthog_plg_resources.insights)),
  )

  posthog_resources = {
    dashboards = merge(
      local.posthog_existing_resources.dashboards,
      local.posthog_plg_resources.dashboards,
    )
    insights = merge(
      local.posthog_existing_resources.insights,
      local.posthog_plg_resources.insights,
    )
  }
  posthog_dashboards = local.posthog_resources.dashboards
  posthog_insights   = local.posthog_resources.insights
}

resource "posthog_dashboard" "managed" {
  for_each = local.posthog_dashboards

  name        = each.value.name
  description = try(each.value.description, null)
  pinned      = each.value.pinned
  tags        = length(try(each.value.tags, [])) > 0 ? toset(each.value.tags) : null

  lifecycle {
    prevent_destroy = true

    precondition {
      condition     = length(local.posthog_dashboard_key_collisions) == 0
      error_message = "PostHog dashboard keys must be unique across posthog_resources.json and posthog_plg_resources.json. Duplicates: ${join(", ", local.posthog_dashboard_key_collisions)}"
    }
  }
}

resource "posthog_insight" "managed" {
  for_each = local.posthog_insights

  # Some imported insights intentionally have no explicit name; PostHog renders
  # those from the provider-computed derived_name. Null preserves that state.
  name        = try(each.value.name, null)
  description = try(each.value.description, null)
  dashboard_ids = length(try(each.value.dashboard_keys, [])) > 0 ? toset([
    for dashboard_key in each.value.dashboard_keys :
    posthog_dashboard.managed[dashboard_key].id
  ]) : null
  tags       = length(try(each.value.tags, [])) > 0 ? toset(each.value.tags) : null
  query_json = jsonencode(each.value.query)

  lifecycle {
    prevent_destroy = true

    precondition {
      condition     = length(local.posthog_insight_key_collisions) == 0
      error_message = "PostHog insight keys must be unique across posthog_resources.json and posthog_plg_resources.json. Duplicates: ${join(", ", local.posthog_insight_key_collisions)}"
    }
  }
}
