import { type ChildProcess, spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const WRANGLER_PORT = 8788;
const MOCK_API_PORT = 8789;
const MOCK_ASSETS_PORT = 8790;
const BASE_URL = `http://localhost:${WRANGLER_PORT}`;

interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

describe("PostHog Proxy Integration Test", () => {
  let wranglerProcess: ChildProcess;
  let mockApiServer: Server;
  let mockAssetsServer: Server;
  const apiRequests: RecordedRequest[] = [];
  const assetsRequests: RecordedRequest[] = [];

  beforeAll(async () => {
    // Start mock PostHog API server
    mockApiServer = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        apiRequests.push({
          method: req.method || "",
          url: req.url || "",
          headers: req.headers,
          body,
        });

        // Return mock responses based on endpoint
        if (req.url?.startsWith("/batch")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: 1 }));
        } else if (req.url?.startsWith("/decide")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ featureFlags: {}, featureFlagPayloads: {} }),
          );
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        }
      });
    });

    // Start mock PostHog assets server
    mockAssetsServer = createServer((req, res) => {
      assetsRequests.push({
        method: req.method || "",
        url: req.url || "",
        headers: req.headers,
        body: "",
      });

      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end("// mock posthog js");
    });

    await new Promise<void>((resolve) =>
      mockApiServer.listen(MOCK_API_PORT, resolve),
    );
    await new Promise<void>((resolve) =>
      mockAssetsServer.listen(MOCK_ASSETS_PORT, resolve),
    );

    // Start wrangler pages dev with mock server URLs
    wranglerProcess = spawn(
      "npx",
      [
        "wrangler",
        "pages",
        "dev",
        "ui/out",
        "--port",
        String(WRANGLER_PORT),
        "--binding",
        `POSTHOG_API_HOST=http://localhost:${MOCK_API_PORT}`,
        "--binding",
        `POSTHOG_ASSETS_HOST=http://localhost:${MOCK_ASSETS_PORT}`,
      ],
      {
        cwd: process.cwd().replace(/\/ui$/, ""),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    wranglerProcess.stderr?.on("data", (data) => {
      const output = data.toString();
      if (output.includes("ERROR")) {
        console.error("Wrangler error:", output);
      }
    });

    await waitForServer(wranglerProcess, 30000);
  }, 60000);

  afterAll(async () => {
    wranglerProcess?.kill();
    await new Promise<void>((resolve) => mockApiServer?.close(() => resolve()));
    await new Promise<void>((resolve) =>
      mockAssetsServer?.close(() => resolve()),
    );
  });

  it("should proxy POST /ingest/batch to PostHog API", async () => {
    const requestBody = {
      batch: [{ event: "test", properties: { distinct_id: "123" } }],
    };

    const response = await fetch(`${BASE_URL}/ingest/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toEqual({ status: 1 });

    // Verify the request was forwarded correctly
    const forwardedRequest = apiRequests.find((r) =>
      r.url?.startsWith("/batch"),
    );
    expect(forwardedRequest).toBeDefined();
    expect(forwardedRequest?.method).toBe("POST");
    expect(JSON.parse(forwardedRequest?.body || "{}")).toEqual(requestBody);
  });

  it("should proxy POST /ingest/decide to PostHog API", async () => {
    const requestBody = { token: "test-token", distinct_id: "user-123" };

    const response = await fetch(`${BASE_URL}/ingest/decide?v=3`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty("featureFlags");

    // Verify the request was forwarded correctly
    const forwardedRequest = apiRequests.find((r) =>
      r.url?.startsWith("/decide"),
    );
    expect(forwardedRequest).toBeDefined();
    expect(forwardedRequest?.method).toBe("POST");
    expect(forwardedRequest?.url).toBe("/decide?v=3");
  });

  it("should proxy static assets from /ingest/static/ to assets host", async () => {
    const response = await fetch(`${BASE_URL}/ingest/static/array.js`);

    expect(response.ok).toBe(true);
    expect(response.headers.get("content-type")).toContain("javascript");
    const content = await response.text();
    expect(content).toBe("// mock posthog js");

    // Verify the request was forwarded to assets server
    const forwardedRequest = assetsRequests.find((r) =>
      r.url?.includes("array.js"),
    );
    expect(forwardedRequest).toBeDefined();
    expect(forwardedRequest?.url).toBe("/static/array.js");
  });
});

async function waitForServer(
  proc: ChildProcess,
  timeout: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Server did not start within ${timeout}ms`));
    }, timeout);

    proc.stdout?.on("data", (data: Buffer) => {
      if (data.toString().includes("Ready on")) {
        clearTimeout(timer);
        resolve();
      }
    });

    proc.on("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0 && code !== null) {
        reject(new Error(`Wrangler process exited with code ${code}`));
      }
    });
  });
}
