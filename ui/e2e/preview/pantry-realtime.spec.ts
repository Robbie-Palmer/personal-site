import {
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  test,
  type WebSocket,
} from "@playwright/test";
import {
  createPreviewContext,
  previewSiteURL,
  signInPreviewScenario,
} from "./preview-test-helpers";

const pantryRealtimePath = "/api/pantry/realtime";
const realtimeTimeoutMs = 10_000;
const visibleConvergenceTimeoutMs = 1_000;

type Scenario = {
  name: "Household owner" | "Household member";
};

type ScenarioSession = {
  context: BrowserContext;
  page: Page;
};

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
  const context = await createPreviewContext(browser);

  try {
    await context.addInitScript(
      ({ realtimePath }) => {
        const NativeWebSocket = window.WebSocket;
        Object.defineProperty(window, "WebSocket", {
          configurable: true,
          writable: true,
          value: class extends NativeWebSocket {
            constructor(url: string | URL, protocols?: string | string[]) {
              if (protocols === undefined) super(url);
              else super(url, protocols);

              if (new URL(this.url).pathname === realtimePath) {
                Object.defineProperty(window, "__closePantryRealtimeSocket", {
                  configurable: true,
                  value: () => this.close(4_000, "Playwright disconnect"),
                });
              }
            }
          },
        });
      },
      { realtimePath: pantryRealtimePath },
    );

    const page = await context.newPage();
    await signInPreviewScenario(page, scenario.name);

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

function waitForPantryChange(
  socket: WebSocket,
  changeKind: string,
  ingredientSlug: string,
  expectedLocation: string | undefined,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Pantry WebSocket did not receive ${changeKind}`));
    }, realtimeTimeoutMs);

    const onFrame = ({ payload }: { payload: string | Buffer }) => {
      const message = parseFrame(payload);
      if (
        message?.type !== "resource.changed" ||
        message.resourceType !== "pantry" ||
        message.changeKind !== changeKind ||
        !message.pantry ||
        typeof message.pantry !== "object" ||
        !("stock" in message.pantry) ||
        !message.pantry.stock ||
        typeof message.pantry.stock !== "object"
      ) {
        return;
      }
      const stock = message.pantry.stock as Record<string, unknown>;
      const matchesIngredient =
        expectedLocation === undefined
          ? !Object.hasOwn(stock, ingredientSlug)
          : stock[ingredientSlug] === expectedLocation;
      if (!matchesIngredient) return;
      cleanup();
      resolve();
    };
    const onSocketError = (error: string) => {
      cleanup();
      reject(new Error(`Pantry WebSocket failed: ${error}`));
    };
    const onClose = () => {
      cleanup();
      reject(new Error("Pantry WebSocket closed before receiving a change"));
    };

    function cleanup() {
      clearTimeout(timeout);
      socket.off("framereceived", onFrame);
      socket.off("socketerror", onSocketError);
      socket.off("close", onClose);
    }

    socket.on("framereceived", onFrame);
    socket.on("socketerror", onSocketError);
    socket.on("close", onClose);
  });
}

async function disconnectPantrySocket(page: Page): Promise<void> {
  await page.evaluate(() => {
    const closeSocket = (
      window as typeof window & {
        __closePantryRealtimeSocket?: () => void;
      }
    ).__closePantryRealtimeSocket;
    if (!closeSocket)
      throw new Error("Pantry WebSocket test control is absent");
    closeSocket();
  });
}

async function openKitchen(session: ScenarioSession): Promise<WebSocket> {
  const subscription = waitForPantrySubscription(session.page);
  await session.page.goto("/recipes/kitchen");
  const socket = await subscription;
  await expect(
    session.page.getByText("Preview Shared Household's kitchen.", {
      exact: true,
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

      const [ownerSocket, memberSocket] = await Promise.all([
        openKitchen(owner),
        openKitchen(member),
      ]);
      await expect(
        owner.page.getByRole("button", { name: "Remove Garlic" }),
      ).toBeVisible();
      await expect(
        member.page.getByRole("button", { name: "Remove Garlic" }),
      ).toBeVisible();

      const memberRemoval = waitForPantryChange(
        memberSocket,
        "pantry.item-removed",
        "garlic",
        undefined,
      );
      await owner.page.getByRole("button", { name: "Remove Garlic" }).click();
      pantryWasChanged = true;
      await memberRemoval;
      await expect(
        member.page.getByRole("button", { name: "Remove Garlic" }),
      ).toHaveCount(0, { timeout: visibleConvergenceTimeoutMs });

      const ownerRestoration = waitForPantryChange(
        ownerSocket,
        "pantry.item-set",
        "garlic",
        "fresh",
      );
      await restoreGarlic(member.context);
      await ownerRestoration;
      await expect(
        owner.page.getByRole("button", { name: "Remove Garlic" }),
      ).toBeVisible({ timeout: visibleConvergenceTimeoutMs });
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
      await disconnectPantrySocket(member.page);
      await memberDisconnected;
      await owner.page.getByRole("button", { name: "Remove Garlic" }).click();
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
