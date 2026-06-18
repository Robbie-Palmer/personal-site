import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

type WebpackCompiler = {
  outputPath: string;
  hooks: {
    afterEmit: {
      tap: (pluginName: string, callback: () => void) => void;
    };
  };
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createNextConfig(phase: string): NextConfig {
  return {
    // Keep Turbopack's development artifacts separate from production builds.
    // Reusing .next after `next build` can leave dev looking for incompatible
    // Pages Router manifests such as pages/_app/build-manifest.json.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    output: "export",
    images: {
      unoptimized: true,
    },
    // Dev-only: proxy auth requests to the local recipe-api Worker.
    // In production the Cloudflare Pages Function (functions/api/auth/) handles this.
    ...(phase === PHASE_DEVELOPMENT_SERVER
      ? {
          async rewrites() {
            return [
              {
                source: "/api/auth/:path*",
                destination: "http://localhost:8787/api/auth/:path*",
              },
            ];
          },
        }
      : {}),
    turbopack: {
      root: path.join(__dirname, ".."),
    },
    // Prevent 'fs' and 'path' from being bundled into client-side chunks.
    // Recipe .cook files are read server-side at build time only; these modules
    // are never called in the browser, so replacing them with empty modules is safe.
    webpack(config, { isServer }) {
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };

      if (isServer) {
        config.plugins = config.plugins ?? [];
        config.plugins.push({
          apply(compiler: WebpackCompiler) {
            compiler.hooks.afterEmit.tap("CooklangServerWasmPathPlugin", () => {
              const outputPath = compiler.outputPath;
              const sourceDir = path.join(outputPath, "chunks/static/wasm");
              const targetDir = path.join(outputPath, "static/wasm");
              const staticExportWasmDir = path.join(
                outputPath,
                "..",
                "static/wasm",
              );

              if (!fs.existsSync(sourceDir)) {
                return;
              }

              fs.mkdirSync(targetDir, { recursive: true });
              fs.mkdirSync(staticExportWasmDir, { recursive: true });
              for (const filename of fs.readdirSync(sourceDir)) {
                if (filename.endsWith(".wasm")) {
                  const sourceFile = path.join(sourceDir, filename);
                  fs.copyFileSync(sourceFile, path.join(targetDir, filename));
                  fs.copyFileSync(
                    sourceFile,
                    path.join(staticExportWasmDir, filename),
                  );
                }
              }
            });
          },
        });
      }

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
}

export default createNextConfig;
