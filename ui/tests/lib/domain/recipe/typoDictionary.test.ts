import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadTypoDictionary,
  parseDictionaryTsv,
  resetTypoDictionaryCache,
} from "@/lib/domain/recipe/typoDictionary";

afterEach(() => {
  resetTypoDictionaryCache();
  vi.restoreAllMocks();
});

describe("parseDictionaryTsv", () => {
  it("parses single, multi and flag-only entries and skips blanks", () => {
    const dict = parseDictionaryTsv(
      "teh\tthe\nseperate\tseparate,desperate\n\nfoo\t\n",
    );
    expect(dict.get("teh")).toEqual(["the"]);
    expect(dict.get("seperate")).toEqual(["separate", "desperate"]);
    expect(dict.get("foo")).toEqual([]);
    expect(dict.size).toBe(3);
  });
});

describe("loadTypoDictionary", () => {
  it("fetches, parses and memoises the asset", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("teh\tthe\n"),
    } as Response);

    const first = await loadTypoDictionary(fetchImpl);
    const second = await loadTypoDictionary(fetchImpl);

    expect(first.get("teh")).toEqual(["the"]);
    expect(second).toBe(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("clears the cache on failure so a retry can succeed", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("teh\tthe\n"),
      } as Response);

    await expect(loadTypoDictionary(fetchImpl)).rejects.toThrow();
    const retry = await loadTypoDictionary(fetchImpl);
    expect(retry.get("teh")).toEqual(["the"]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
