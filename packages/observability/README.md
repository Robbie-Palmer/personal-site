# Recipe observability

Shared OpenTelemetry instrumentation for the recipe site's Cloudflare Pages
Functions, API Worker, and ingestion Workflow.

The package exports OTLP/protobuf directly to PostHog:

- traces: `${POSTHOG_OTLP_BASE_URL}/i/v1/traces`
- correlated logs: `${POSTHOG_OTLP_BASE_URL}/i/v1/logs`

Authentication uses `Authorization: Bearer ${POSTHOG_KEY}`, where
`POSTHOG_KEY` is the public `phc_…` project token.

Direct export is intentional. Cloudflare's native Workers observability
destination exports OTLP/JSON and currently documents PostHog traces as
unsupported, while PostHog's distributed-tracing endpoint requires
OTLP/HTTP protobuf. Native Cloudflare logs remain enabled as a fallback.

## Trace shape

```text
recipe-pages
└── HTTP … recipe-api
    └── recipe-api
        └── workflow.start recipe-ingest
            ├── workflow.step start
            ├── workflow.step extract
            ├── workflow.step persist-extract
            ├── workflow.step normalize
            ├── workflow.step persist-normalize
            ├── workflow.step canonicalize
            ├── workflow.step persist-canonicalize
            └── workflow.step finalize
```

The Workflow context is serialized into its parameters because that durable
boundary is not an HTTP request. Every Workflow span/export runs inside its
`step.do()` callback, where side effects are durable and are not duplicated by
Workflow engine replays. All HTTP boundaries use W3C Trace Context.

## Verification

After deploying all three runtimes:

1. Start a photo recipe import from the recipe site.
2. In PostHog Tracing, filter `service.name` to `recipe-pages`, `recipe-api`,
   or `recipe-ingest`.
3. Open the trace and confirm its waterfall includes the Pages request, API
   request, workflow start, and durable step spans.
4. Open a span's correlated logs and confirm `sessionId`,
   `posthogDistinctId`, and `recipe.import.job_id` where applicable.
