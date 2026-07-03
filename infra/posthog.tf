# PostHog product analytics-as-code.

resource "posthog_dashboard" "product_success" {
  name        = "Product Success"
  description = "Core product success metrics for the personal site."
  pinned      = true
  tags        = ["product", "success", "terraform"]
}

resource "posthog_insight" "weekly_active_visitors" {
  name          = "Weekly active visitors"
  description   = "Unique visitors by week based on pageviews."
  dashboard_ids = [posthog_dashboard.product_success.id]
  tags          = ["product", "success", "terraform"]

  query_json = jsonencode({
    kind = "InsightVizNode"
    source = {
      kind     = "TrendsQuery"
      interval = "week"
      dateRange = {
        date_from = "-90d"
      }
      series = [
        {
          kind  = "EventsNode"
          event = "$pageview"
          name  = "$pageview"
          math  = "dau"
        }
      ]
      trendsFilter = {
        display = "ActionsLineGraph"
      }
    }
  })
}
