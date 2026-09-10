import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Cesium browser runtime", () => {
  beforeEach(() => {
    vi.resetModules();
    delete window.Cesium;
    delete window.CESIUM_BASE_URL;
    document.querySelector("script[data-cesium-runtime]")?.remove();
  });

  afterEach(() => {
    delete window.Cesium;
    delete window.CESIUM_BASE_URL;
    document.querySelector("script[data-cesium-runtime]")?.remove();
  });

  it("loads the prebuilt API from the self-hosted Cesium path", async () => {
    const { loadCesiumRuntime } = await import(
      "@/components/technology/cesium/cesium-runtime"
    );
    const runtime = { VERSION: "test" } as unknown as NonNullable<
      Window["Cesium"]
    >;

    const loading = loadCesiumRuntime();
    const script = document.querySelector<HTMLScriptElement>(
      "script[data-cesium-runtime]",
    );
    if (!script) throw new Error("Expected the Cesium runtime script");

    expect(script.src).toBe(`${window.location.origin}/cesium/Cesium.js`);
    expect(window.CESIUM_BASE_URL).toBe("/cesium/");

    window.Cesium = runtime;
    script.dispatchEvent(new Event("load"));

    await expect(loading).resolves.toBe(runtime);
  });
});
