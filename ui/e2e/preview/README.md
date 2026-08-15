# Authenticated preview tests

These Playwright tests run against a deployed pull-request preview. They use
two isolated browser contexts so the household owner and household member have
separate application sessions while sharing the same seeded pantry. Their
scope is the browser boundary: visible UI convergence and recovery after
reconnecting.

The preview deployment pipeline separately runs a direct Worker smoke test for
the realtime protocol, including the event resource, revision, operation ID,
and change kind. Keeping those checks out of this suite avoids making browser
QA the only evidence that the backend fan-out works.

The tests intentionally mutate the seeded `Garlic` pantry item and restore it
during cleanup. Do not point them at production.

## Run

Install the Chromium browser once:

```sh
mise //ui:test:e2e:install
```

Then run the suite with the canonical preview URL and Cloudflare Access
service-token credentials:

```sh
PREVIEW_SITE_URL=https://pr-123.example.pages.dev \
CF_ACCESS_CLIENT_ID=... \
CF_ACCESS_CLIENT_SECRET=... \
mise //ui:test:e2e:preview
```

The preview must have its backend enabled and seeded preview scenarios. The
suite is not part of the generic UI check because it requires a deployed,
authenticated, mutable preview environment.
