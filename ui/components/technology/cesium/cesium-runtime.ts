import type * as CesiumModule from "cesium";

export type CesiumRuntime = typeof CesiumModule;

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
    Cesium?: CesiumRuntime;
  }
}

let runtimePromise: Promise<CesiumRuntime> | undefined;

export function loadCesiumRuntime(): Promise<CesiumRuntime> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Cesium requires a browser"));
  }

  window.CESIUM_BASE_URL = "/cesium/";
  if (window.Cesium) return Promise.resolve(window.Cesium);
  if (runtimePromise) return runtimePromise;

  runtimePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-cesium-runtime]",
    );
    const script = existing ?? document.createElement("script");

    const loaded = () => {
      if (window.Cesium) {
        resolve(window.Cesium);
      } else {
        script.remove();
        runtimePromise = undefined;
        reject(new Error("Cesium loaded without exposing its browser API"));
      }
    };
    const failed = () => {
      script.remove();
      runtimePromise = undefined;
      reject(new Error("The self-hosted Cesium runtime failed to load"));
    };

    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", failed, { once: true });

    if (!existing) {
      script.async = true;
      script.dataset.cesiumRuntime = "";
      script.src = "/cesium/Cesium.js";
      document.head.appendChild(script);
    }
  });

  return runtimePromise;
}
