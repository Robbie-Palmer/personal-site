import { defineConfig, devices } from "@playwright/test";

// Keep the config importable by static tooling such as Knip. The test module
// itself fails fast when PREVIEW_SITE_URL or either Access credential is absent.
const configuredPreviewSiteURL = process.env.PREVIEW_SITE_URL;
const configuredPagesHost = process.env.CLOUDFLARE_PAGES_HOST?.toLowerCase();
const previewSiteURL = new URL(
  configuredPreviewSiteURL ?? "https://pr-0.invalid.pages.dev",
);
if (configuredPreviewSiteURL) {
  const previewLabel = previewSiteURL.hostname.split(".", 1)[0];
  if (
    !configuredPagesHost ||
    previewSiteURL.protocol !== "https:" ||
    previewSiteURL.origin !== previewSiteURL.href.replace(/\/$/, "") ||
    !previewLabel ||
    !/^pr-[1-9]\d*$/.test(previewLabel) ||
    previewSiteURL.hostname !== `${previewLabel}.${configuredPagesHost}`
  ) {
    throw new Error(
      "PREVIEW_SITE_URL must be the canonical HTTPS PR alias for CLOUDFLARE_PAGES_HOST",
    );
  }
}

export default defineConfig({
  testDir: "./e2e/preview",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  outputDir: "test-results/preview",
  use: {
    baseURL: previewSiteURL.origin,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
