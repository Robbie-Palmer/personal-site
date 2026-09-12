import {
  type Browser,
  type BrowserContext,
  expect,
  type Page,
} from "@playwright/test";
import { requiredEnv } from "node-base/env";

export const previewSiteURL = new URL(requiredEnv("PREVIEW_SITE_URL"));
const pagesHost = requiredEnv("CLOUDFLARE_PAGES_HOST").toLowerCase();
const accessHeaders = {
  "CF-Access-Client-Id": requiredEnv("CF_ACCESS_CLIENT_ID"),
  "CF-Access-Client-Secret": requiredEnv("CF_ACCESS_CLIENT_SECRET"),
};

function assertCanonicalPreviewURL(): void {
  const previewLabel = previewSiteURL.hostname.split(".", 1)[0];
  if (
    previewSiteURL.protocol !== "https:" ||
    previewSiteURL.origin !== previewSiteURL.href.replace(/\/$/, "") ||
    !previewLabel ||
    !/^pr-[1-9]\d*$/.test(previewLabel) ||
    previewSiteURL.hostname !== `${previewLabel}.${pagesHost}`
  ) {
    throw new Error(
      "PREVIEW_SITE_URL must be the canonical HTTPS PR alias for CLOUDFLARE_PAGES_HOST",
    );
  }
}

assertCanonicalPreviewURL();

export function previewURL(input: string): string {
  const url = new URL(input, previewSiteURL.origin);
  if (url.origin !== previewSiteURL.origin) {
    throw new Error(`Preview request must stay on ${previewSiteURL.origin}`);
  }
  return url.href;
}

export async function createPreviewContext(
  browser: Browser,
): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL: previewSiteURL.origin });

  try {
    // Send the service-token headers only to the canonical preview origin. The
    // resulting Access cookie authenticates later page, API, and WebSocket use.
    const accessResponse = await context.request.get(previewURL("/recipes"), {
      headers: accessHeaders,
      maxRedirects: 0,
    });
    const responseURL = new URL(accessResponse.url());
    if (!accessResponse.ok() || responseURL.origin !== previewSiteURL.origin) {
      throw new Error(
        `Cloudflare Access did not authorize the preview (${accessResponse.status()} ${accessResponse.url()})`,
      );
    }
    await accessResponse.dispose();
    return context;
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function signInPreviewScenario(
  page: Page,
  scenarioName: string,
): Promise<void> {
  await page.goto("/recipes");
  await expect(page).toHaveURL(`${previewSiteURL.origin}/recipes`);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(scenarioName) }).click();
  await expect(
    page.getByRole("button", { name: `Account for ${scenarioName}` }),
  ).toBeVisible();
}
