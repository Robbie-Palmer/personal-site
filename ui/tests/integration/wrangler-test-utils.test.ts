import { spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { killProcessGroup, waitForServer } from "./wrangler-test-utils";

describe("Wrangler test process management", () => {
  let child: ReturnType<typeof spawn> | undefined;

  afterEach(() => killProcessGroup(child));

  it("drains stderr while waiting for the server", async () => {
    child = spawn(
      process.execPath,
      [
        "--eval",
        'process.stderr.write("x".repeat(256 * 1024), () => console.log("Ready on mock server"));',
      ],
      {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    await expect(waitForServer(child, 5_000)).resolves.toBeUndefined();
  });
});
