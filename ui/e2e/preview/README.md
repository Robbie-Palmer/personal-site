# Authenticated preview tests

These Playwright tests run against a deployed pull-request preview. The pantry
tests use two isolated browser contexts so the household owner and household
member have separate sessions while sharing the same seeded pantry. The recipe
PWA tests sign in as the household owner, wait for the offline caches, disable
the network, and follow the same recovery links available to a user.

The preview deployment pipeline separately runs a direct Worker smoke test for
the realtime protocol, including the event resource, revision, operation ID,
and change kind. Keeping those checks out of this suite avoids making browser
QA the only evidence that the backend fan-out works.

The pantry tests intentionally mutate the seeded `Garlic` item and restore it
during cleanup. The PWA tests only change browser-local storage and network
emulation. Do not point this suite at production.

## Run

Run the suite with the canonical preview URL and inject the preview-only
Cloudflare Access service-token credentials from Doppler:

```sh
PREVIEW_SITE_URL=https://pr-123.example.pages.dev \
doppler run --project personal-site --config dev_agent -- \
  mise //ui:test:e2e:preview
```

The mise task installs the required Chromium build when needed.

Agent launchers that already inject `dev_agent` can run the mise task directly
with only `PREVIEW_SITE_URL` set.

The suite validates that the URL is the canonical PR alias for the configured
Pages host. It sends the Access credentials only on an exact-origin priming
request; subsequent page and WebSocket requests use the resulting Access
cookie, so the service-token headers cannot accompany third-party requests.

The preview must have its backend enabled and seeded preview scenarios. The
suite is not part of the generic UI check because it requires a deployed,
authenticated, mutable preview environment.
