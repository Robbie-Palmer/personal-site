import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function runDeploy(openCodeKey?: string) {
  const directory = mkdtempSync(join(tmpdir(), "ai-review-deploy-test-"));
  temporaryDirectories.push(directory);
  const bin = join(directory, "bin");
  const capture = join(directory, "captured-secrets.json");
  const calls = join(directory, "calls.txt");
  mkdirSync(bin);
  const fakePnpm = join(bin, "pnpm");
  writeFileSync(
    fakePnpm,
    `#!/bin/sh
printf '%s\\n' "$*" >> "$CALLS_FILE"
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--secrets-file" ]; then
    shift
    cp "$1" "$CAPTURE_FILE"
    exit 0
  fi
  if [ -f "$1" ]; then
    cp "$1" "$CAPTURE_FILE"
    exit 0
  fi
  shift
done
exit 0
`,
  );
  chmodSync(fakePnpm, 0o700);

  const result = spawnSync("bash", ["scripts/deploy.sh"], {
    cwd: join(import.meta.dirname, ".."),
    encoding: "utf8",
    env: {
      ...process.env,
      AI_REVIEW_APP_ID: "app-id",
      AI_REVIEW_APP_INSTALLATION_ID: "installation-id",
      AI_REVIEW_APP_PRIVATE_KEY: "private-key",
      AI_REVIEW_WEBHOOK_SECRET: "webhook-secret",
      OPENROUTER_API_KEY: "openrouter-key",
      CLOUDFLARE_ACCOUNT_ID: "cloudflare-account",
      CLOUDFLARE_API_TOKEN: "cloudflare-token",
      OPENCODE_API_KEY: openCodeKey ?? "",
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      TMPDIR: directory,
      CAPTURE_FILE: capture,
      CALLS_FILE: calls,
    },
  });

  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  return {
    calls: readFileSync(calls, "utf8"),
    secrets: JSON.parse(readFileSync(capture, "utf8")) as Record<
      string,
      string | null
    >,
  };
}

describe("AI review deployment", () => {
  it("removes a stale optional OpenCode secret when the source is absent", () => {
    const result = runDeploy();

    expect(result.secrets.OPENCODE_API_KEY).toBeNull();
    expect(result.calls).toContain("wrangler deploy --secrets-file");
    expect(result.calls).toContain("wrangler secret bulk");
  });

  it("uploads a configured OpenCode secret", () => {
    expect(runDeploy("opencode-key").secrets.OPENCODE_API_KEY).toBe(
      "opencode-key",
    );
  });
});
