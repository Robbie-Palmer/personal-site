import { describe, expect, it } from "vitest";
import { parseIntVar, stageParams } from "../src/params";
import type { Env } from "../src/env";

const baseEnv = {
  OPENROUTER_API_KEY: "test",
} as Env;

describe("parseIntVar", () => {
  it("parses integer strings", () => {
    expect(parseIntVar("2500", 1)).toBe(2500);
  });

  it("falls back for undefined, malformed, and negative values", () => {
    expect(parseIntVar(undefined, 7)).toBe(7);
    expect(parseIntVar("abc", 7)).toBe(7);
    expect(parseIntVar("-1", 7)).toBe(7);
    expect(parseIntVar("1.5", 7)).toBe(7);
  });
});

describe("stageParams", () => {
  it("returns params.yaml-aligned defaults", () => {
    expect(stageParams(baseEnv, "extract")).toEqual({
      model: "google/gemini-3-flash-preview",
      requestTimeoutMs: 30_000,
      retryLimit: 2,
    });
    expect(stageParams(baseEnv, "canonicalize")).toEqual({
      model: "google/gemini-2.5-flash",
      requestTimeoutMs: 15_000,
      retryLimit: 1,
    });
  });

  it("prefers env vars over defaults", () => {
    const env = {
      ...baseEnv,
      NORMALIZE_MODEL: "test/model",
      NORMALIZE_TIMEOUT_MS: "5000",
      NORMALIZE_RETRIES: "0",
    } as Env;
    expect(stageParams(env, "normalize")).toEqual({
      model: "test/model",
      requestTimeoutMs: 5_000,
      retryLimit: 0,
    });
  });
});
