import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest, isApiError } from "@/lib/api/http";

describe("apiRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the shared credentials policy and encodes JSON bodies", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ saved: true }));

    await expect(
      apiRequest<{ saved: boolean }>("/api/example", {
        method: "POST",
        headers: { "x-request-id": "request-1" },
        json: { name: "Dinner" },
      }),
    ).resolves.toEqual({ saved: true });

    const [, request] = fetchMock.mock.calls[0] ?? [];
    expect(request).toMatchObject({
      body: JSON.stringify({ name: "Dinner" }),
      credentials: "same-origin",
      method: "POST",
    });
    const headers = new Headers(request?.headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-request-id")).toBe("request-1");
  });

  it("normalises structured failures into typed API errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          code: "invalid_recipe",
          error: "Invalid request body",
          details: [
            {
              code: "too_small",
              path: ["ingredients", "0", "name"],
              message: "Required",
            },
          ],
        },
        { status: 400 },
      ),
    );

    const request = apiRequest("/api/example", {
      fallbackMessage: "The recipe could not be saved.",
    });

    await expect(request).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      code: "invalid_recipe",
      message: "ingredients.0.name: Required",
      details: [
        {
          code: "too_small",
          path: ["ingredients", "0", "name"],
          message: "Required",
        },
      ],
    });
    await request.catch((error: unknown) => {
      expect(isApiError(error)).toBe(true);
    });
  });

  it("supports nested error messages and fallback copy", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: "import_failed", message: "Image was blurry" } },
          { status: 422 },
        ),
      )
      .mockResolvedValueOnce(new Response("not json", { status: 502 }));

    await expect(apiRequest("/api/import")).rejects.toMatchObject({
      code: "import_failed",
      message: "Image was blurry",
      status: 422,
    });
    await expect(
      apiRequest("/api/import", { fallbackMessage: "Import unavailable" }),
    ).rejects.toMatchObject({ message: "Import unavailable", status: 502 });
  });

  it("allows successful responses with no body when requested", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    await expect(
      apiRequest<void>("/api/example", { responseType: "void" }),
    ).resolves.toBeUndefined();
  });

  it("rejects malformed successful JSON with a typed error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not json", { status: 200 }),
    );

    await expect(
      apiRequest("/api/example", { fallbackMessage: "Invalid API response" }),
    ).rejects.toEqual(expect.any(ApiError));
  });
});
