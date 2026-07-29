import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTypoDictionary } from "@/hooks/use-typo-dictionary";
import { resetTypoDictionaryCache } from "@/lib/domain/recipe/typoDictionary";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetTypoDictionaryCache();
  vi.restoreAllMocks();
});

describe("useTypoDictionary", () => {
  it("loads and exposes the dictionary once fetched", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("teh\tthe\n", { status: 200 }),
    ) as typeof fetch;

    const { result } = renderHook(() => useTypoDictionary());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.dictionary?.get("teh")).toEqual(["the"]);
  });

  it("stays usable and marks ready when the asset fails to load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn(
      async () => new Response("not found", { status: 404 }),
    ) as typeof fetch;

    const { result } = renderHook(() => useTypoDictionary());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.dictionary).toBeNull();
  });

  it("refetches when retry is called after a failed load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("nope", { status: 500 }))
      .mockResolvedValueOnce(new Response("teh\tthe\n", { status: 200 }));
    globalThis.fetch = fetchMock as typeof fetch;

    const { result } = renderHook(() => useTypoDictionary());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.dictionary).toBeNull();

    result.current.retry();

    await waitFor(() =>
      expect(result.current.dictionary?.get("teh")).toEqual(["the"]),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
