import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const importCesiumRuntime = vi.fn();

vi.mock("@/components/technology/cesium/import-cesium-runtime", () => ({
  importCesiumRuntime,
}));

describe("Cesium browser runtime", () => {
  beforeEach(() => {
    vi.resetModules();
    delete window.CESIUM_BASE_URL;
    importCesiumRuntime.mockReset();
  });

  afterEach(() => {
    delete window.CESIUM_BASE_URL;
  });

  it("loads and caches the self-hosted module API", async () => {
    const { loadCesiumRuntime } = await import(
      "@/components/technology/cesium/cesium-runtime"
    );
    const runtime = { VERSION: "test" };
    importCesiumRuntime.mockResolvedValue(runtime);

    await expect(loadCesiumRuntime()).resolves.toBe(runtime);
    await expect(loadCesiumRuntime()).resolves.toBe(runtime);
    expect(importCesiumRuntime).toHaveBeenCalledTimes(1);
    expect(window.CESIUM_BASE_URL).toBe("/cesium/");
  });

  it("retries after the module import fails", async () => {
    const { loadCesiumRuntime } = await import(
      "@/components/technology/cesium/cesium-runtime"
    );
    const runtime = { VERSION: "test" };
    importCesiumRuntime
      .mockRejectedValueOnce(new SyntaxError("Unexpected token"))
      .mockResolvedValueOnce(runtime);

    await expect(loadCesiumRuntime()).rejects.toThrow(
      "The self-hosted Cesium runtime failed to load: Unexpected token",
    );
    await expect(loadCesiumRuntime()).resolves.toBe(runtime);
    expect(importCesiumRuntime).toHaveBeenCalledTimes(2);
  });
});
