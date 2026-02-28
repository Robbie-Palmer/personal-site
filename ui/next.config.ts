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
