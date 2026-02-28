import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  // Keep @cooklang/cooklang out of the webpack bundle entirely.
  // It uses WASM bindings and is only called server-side at build time;
  // Node.js loads it natively from node_modules without webpack processing.
  serverExternalPackages: ["@cooklang/cooklang"],
  // Prevent 'fs' and 'path' from being bundled into client-side chunks.
  // Recipe .cook files are read server-side at build time only; these modules
  // are never called in the browser, so replacing them with empty modules is safe.
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve = {
        ...config.resolve,
        fallback: {
          ...config.resolve?.fallback,
          fs: false,
          path: false,
        },
      };
    }
    return config;
  },
};

export default nextConfig;
