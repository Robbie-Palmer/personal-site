import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
  type WebSocket,
} from "@playwright/test";

const previewSiteURL = new URL(requiredEnv("PREVIEW_SITE_URL"));
const accessHeaders = {
  "CF-Access-Client-Id": requiredEnv("CF_ACCESS_CLIENT_ID"),
  "CF-Access-Client-Secret": requiredEnv("CF_ACCESS_CLIENT_SECRET"),
};
const pantryRealtimePath = "/api/pantry/realtime";
const realtimeTimeoutMs = 10_000;

type Scenario = {
  name: "Household owner" | "Household member";
};

type ScenarioSession = {
  context: BrowserContext;
  page: Page;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseFrame(payload: string | Buffer): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(payload.toString());
    return value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function createScenarioSession(
  browser: Browser,
  scenario: Scenario,
): Promise<ScenarioSession> {
  const context = await browser.newContext({
    baseURL: previewSiteURL.origin,
    extraHTTPHeaders: accessHeaders,
  });

  try {
    // Prime the Access application cookie before the browser opens the page.
    // The cookie is then available to the page's own WebSocket handshake.
    const accessResponse = await context.request.get("/recipes");
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
    await expect(page).toHaveURL(`${previewSiteURL.origin}/recipes`);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page
      .getByRole("button", { name: new RegExp(scenario.name) })
      .click();
    await expect(
      page.getByRole("button", { name: `Account for ${scenario.name}` }),
    ).toBeVisible();

    return { context, page };
  } catch (error) {
    await context.close();
    throw error;
  }
}

function waitForPantrySubscription(page: Page): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Pantry WebSocket did not become ready"));
    }, realtimeTimeoutMs);

    const onWebSocket = (socket: WebSocket) => {
      if (new URL(socket.url()).pathname !== pantryRealtimePath) return;

      const onFrame = ({ payload }: { payload: string | Buffer }) => {
        const message = parseFrame(payload);
        if (
          message?.type === "subscription.ready" &&
          message.resourceType === "pantry"
        ) {
          cleanup();
          resolve(socket);
        }
      };
      socket.on("framereceived", onFrame);
      socket.on("socketerror", (error) => {
        cleanup();
        reject(new Error(`Pantry WebSocket failed: ${error}`));
      });

      function cleanup() {
        clearTimeout(timeout);
        page.off("websocket", onWebSocket);
        socket.off("framereceived", onFrame);
      }
    };

    function cleanup() {
      clearTimeout(timeout);
      page.off("websocket", onWebSocket);
    }

    page.on("websocket", onWebSocket);
  });
}

function waitForSocketClose(socket: WebSocket): Promise<void> {
  return socket
    .waitForEvent("close", { timeout: realtimeTimeoutMs })
    .then(() => undefined);
}

async function openKitchen(session: ScenarioSession): Promise<WebSocket> {
  const subscription = waitForPantrySubscription(session.page);
  await session.page.goto("/recipes/kitchen");
  const socket = await subscription;
  await expect(
    session.page.getByRole("heading", {
      name: "Preview Shared Household's kitchen.",
    }),
  ).toBeVisible();
  return socket;
}

async function restoreGarlic(context: BrowserContext): Promise<void> {
  const response = await context.request.put("/api/pantry/items/garlic", {
    data: { location: "fresh" },
    headers: {
      "idempotency-key": crypto.randomUUID(),
      origin: previewSiteURL.origin,
    },
  });
  if (!response.ok()) {
    throw new Error(
      `Could not restore the preview pantry (${response.status()} ${await response.text()})`,
    );
  }
  await response.dispose();
}

async function closeSessions(sessions: ScenarioSession[]): Promise<void> {
  await Promise.allSettled(sessions.map(({ context }) => context.close()));
}

const ownerScenario: Scenario = {
  name: "Household owner",
};
const memberScenario: Scenario = {
  name: "Household member",
};

test.describe.configure({ mode: "serial" });

test.describe("deployed household pantry realtime", () => {
  test("fans a committed pantry change out to another household session", async ({
    browser,
  }) => {
    const sessions: ScenarioSession[] = [];
    let pantryWasChanged = false;
    try {
      const owner = await createScenarioSession(browser, ownerScenario);
      sessions.push(owner);
      const member = await createScenarioSession(browser, memberScenario);
      sessions.push(member);
      await restoreGarlic(owner.context);

      await Promise.all([
        openKitchen(owner),
        openKitchen(member),
      ]);
      await expect(
        owner.page.getByRole("button", { name: "Remove Garlic" }),
      ).toBeVisible();
      await expect(
        member.page.getByRole("button", { name: "Remove Garlic" }),
      ).toBeVisible();

      await owner.page
        .getByRole("button", { name: "Remove Garlic" })
        .click();
      pantryWasChanged = true;
      await expect(
        member.page.getByRole("button", { name: "Remove Garlic" }),
      ).toHaveCount(0, { timeout: realtimeTimeoutMs });

      await restoreGarlic(member.context);
      await expect(
        owner.page.getByRole("button", { name: "Remove Garlic" }),
      ).toBeVisible({ timeout: realtimeTimeoutMs });
      pantryWasChanged = false;
    } finally {
      if (pantryWasChanged && sessions[0]) {
        await restoreGarlic(sessions[0].context).catch(() => undefined);
      }
      await closeSessions(sessions);
    }
  });

  test("recovers the canonical pantry after a household session reconnects", async ({
    browser,
  }) => {
    const sessions: ScenarioSession[] = [];
    let pantryWasChanged = false;
    try {
      const owner = await createScenarioSession(browser, ownerScenario);
      sessions.push(owner);
      const member = await createScenarioSession(browser, memberScenario);
      sessions.push(member);
      await restoreGarlic(owner.context);
      const [, memberSocket] = await Promise.all([
        openKitchen(owner),
        openKitchen(member),
      ]);

      const memberDisconnected = waitForSocketClose(memberSocket);
      await member.context.setOffline(true);
      await memberDisconnected;
      await owner.page
        .getByRole("button", { name: "Remove Garlic" })
        .click();
      pantryWasChanged = true;
      await expect(
        owner.page.getByRole("button", { name: "Remove Garlic" }),
      ).toHaveCount(0);

      const reconnected = waitForPantrySubscription(member.page);
      await member.context.setOffline(false);
      await reconnected;
      await expect(
        member.page.getByRole("button", { name: "Remove Garlic" }),
      ).toHaveCount(0, { timeout: realtimeTimeoutMs });
    } finally {
      if (pantryWasChanged && sessions[0]) {
        await sessions[0].context.setOffline(false).catch(() => undefined);
        await restoreGarlic(sessions[0].context).catch(() => undefined);
      }
      await closeSessions(sessions);
    }
  });
});
