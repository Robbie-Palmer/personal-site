import fs from "node:fs";
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
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    if (isServer) {
      config.plugins = config.plugins ?? [];
      config.plugins.push({
        apply(compiler: any) {
          compiler.hooks.afterEmit.tap("CooklangServerWasmPathPlugin", () => {
            const outputPath = compiler.outputPath as string;
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

export default nextConfig;
