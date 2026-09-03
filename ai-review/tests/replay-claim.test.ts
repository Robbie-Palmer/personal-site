import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exclusiveClaim } from "../analytics/replay-claim";

describe("replay file claims", () => {
  it("keeps an active claim exclusive", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "replay-claim-active-"));
    const claim = path.join(root, "replay.claim");

    expect(exclusiveClaim(claim, 60_000, 100_000)).toBe(true);
    fs.utimesSync(claim, new Date(90_000), new Date(90_000));
    expect(exclusiveClaim(claim, 60_000, 100_000)).toBe(false);
  });

  it("atomically replaces a stale claim", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "replay-claim-stale-"));
    const claim = path.join(root, "nested/replay.claim");

    expect(exclusiveClaim(claim, 60_000, 100_000)).toBe(true);
    fs.utimesSync(claim, new Date(10_000), new Date(10_000));
    expect(exclusiveClaim(claim, 60_000, 100_000)).toBe(true);
    expect(fs.readdirSync(path.dirname(claim))).toEqual(["replay.claim"]);
  });

  it("rejects an invalid expiry", () => {
    expect(() => exclusiveClaim("unused", 0)).toThrow("claim expiry must be a positive number");
  });
});
