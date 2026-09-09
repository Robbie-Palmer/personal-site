import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { requiredEnv } from "node-base/env";

const previewSiteURL = new URL(requiredEnv("PREVIEW_SITE_URL"));
const pagesHost = requiredEnv("CLOUDFLARE_PAGES_HOST");
const accessHeaders = {
  "CF-Access-Client-Id": requiredEnv("CF_ACCESS_CLIENT_ID"),
  "CF-Access-Client-Secret": requiredEnv("CF_ACCESS_CLIENT_SECRET"),
};

type PreviewSession = {
  context: BrowserContext;
  page: Page;
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

async function openOwnerRecipeSession(
  browser: Browser,
): Promise<PreviewSession> {
  const context = await browser.newContext({ baseURL: previewSiteURL.origin });

  try {
    const accessResponse = await context.request.get(
      `${previewSiteURL.origin}/recipes`,
      { headers: accessHeaders, maxRedirects: 0 },
    );
    const accessResponseURL = new URL(accessResponse.url());
    if (
      !accessResponse.ok() ||
      accessResponseURL.origin !== previewSiteURL.origin
    ) {
      throw new Error(
        `Cloudflare Access did not authorize the preview (${accessResponse.status()} ${accessResponse.url()})`,
      );
    }
    await accessResponse.dispose();

    const page = await context.newPage();
    await page.goto("/recipes");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page
      .getByRole("button", { name: /Household owner/ })
      .click();
    await expect(
      page.getByRole("button", { name: "Account for Household owner" }),
    ).toBeVisible();
    await expect(page.getByText("Your recipe box", { exact: true })).toBeVisible();

    return { context, page };
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function waitForOfflineRecipeData(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error("The recipe service worker did not take control")),
        10_000,
      );
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
          window.clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
    });
  });

  await expect
    .poll(() =>
      page.evaluate(async () => {
        const sessionCache = await caches.open("recipe-session-v1");
        const session = await sessionCache.match(
          new Request(`${window.location.origin}/recipes/__offline-session`),
        );
        if (!session) return false;

        const databases = await indexedDB.databases();
        if (!databases.some(({ name }) => name === "robbies-recipes")) {
          return false;
        }

        return new Promise<boolean>((resolve) => {
          const request = indexedDB.open("robbies-recipes");
          request.onerror = () => resolve(false);
          request.onsuccess = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains("recipe-snapshots")) {
              database.close();
              resolve(false);
              return;
            }
            const count = database
              .transaction("recipe-snapshots")
              .objectStore("recipe-snapshots")
              .count();
            count.onerror = () => {
              database.close();
              resolve(false);
            };
            count.onsuccess = () => {
              database.close();
              resolve(count.result > 0);
            };
          };
        });
      }),
    )
    .toBe(true);
}

async function clearOfflineRecipeSnapshots(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("robbies-recipes");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            "recipe-snapshots",
            "readwrite",
          );
          transaction.onerror = () => reject(transaction.error);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.objectStore("recipe-snapshots").clear();
        };
      }),
  );
}

test.describe.configure({ mode: "serial" });

test.describe("deployed recipe PWA offline navigation", () => {
  test("routes unavailable app navigation through the offline page", async ({
    browser,
  }) => {
    const { context, page } = await openOwnerRecipeSession(browser);
    try {
      await waitForOfflineRecipeData(page);
      await context.setOffline(true);

      const destinations = [
        { name: "Discover", path: "/recipes/discover" },
        { name: "Kitchen", path: "/recipes/kitchen" },
        { name: "Log", path: "/recipes/log" },
        { name: "Shopping", path: "/recipes/shopping" },
      ];

      const expectOfflineDestination = async (path: string) => {
        await expect(page).toHaveURL(`${previewSiteURL.origin}${path}`);
        await expect(
          page.getByRole("heading", { name: "You're offline" }),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "Recipe not found" }),
        ).toHaveCount(0);

        await page.getByRole("link", { name: "Back to recipes" }).click();
        await expect(page).toHaveURL(`${previewSiteURL.origin}/recipes`);
        await expect(
          page.getByText("Your recipe box", { exact: true }),
        ).toBeVisible();
      };

      for (const destination of destinations) {
        await page
          .getByRole("link", { name: destination.name, exact: true })
          .click();
        await expectOfflineDestination(destination.path);
      }

      await page.getByRole("link", { name: /^Notifications/ }).click();
      await expectOfflineDestination("/recipes/notifications");

      await page
        .getByRole("button", { name: "Account for Household owner" })
        .click();
      await page.getByRole("link", { name: "Profile", exact: true }).click();
      await expectOfflineDestination("/recipes/profile");

      await page
        .getByRole("button", { name: "Account for Household owner" })
        .click();
      await page.getByRole("link", { name: "Settings", exact: true }).click();
      await expectOfflineDestination("/recipes/settings");
    } finally {
      await context.close();
    }
  });

  test("opens the offline explanation from an unavailable diet notice", async ({
    browser,
  }) => {
    const { context, page } = await openOwnerRecipeSession(browser);
    try {
      await waitForOfflineRecipeData(page);
      await context.setOffline(true);
      await clearOfflineRecipeSnapshots(page);
      await page.reload();

      await expect(
        page.getByRole("alert").filter({
          hasText: "Diet preferences are unavailable.",
        }),
      ).toBeVisible();
      await page.getByRole("link", { name: "diet settings" }).click();

      await expect(page).toHaveURL(
        `${previewSiteURL.origin}/recipes/settings?section=diet`,
      );
      await expect(
        page.getByRole("heading", { name: "You're offline" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Recipe not found" }),
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
