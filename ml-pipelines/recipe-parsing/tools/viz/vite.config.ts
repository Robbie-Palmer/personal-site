import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import path from "node:path";
import fs from "node:fs";

const pipelineRoot = path.resolve(__dirname, "../..");

function collectBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

/**
 * Serves files from the pipeline root under the /pipeline/ URL prefix.
 * e.g. /pipeline/data/recipe-images/PXL_123.jpg -> ../../data/recipe-images/PXL_123.jpg
 */
function servePipelineFiles(): Plugin {
  return {
    name: "serve-pipeline-files",
    configureServer(server) {
      // Write endpoint for ground truth annotations
      server.middlewares.use("/pipeline/api/ground-truth", async (req, res, next) => {
        if (req.method !== "POST") return next();

        try {
          const body = await collectBody(req);
          const json = JSON.parse(body);
          // Basic structural check — full Zod validation happens at pipeline run time
          if (!json?.entries || !Array.isArray(json.entries)) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Expected { entries: [...] }" }));
            return;
          }
          const target = path.join(pipelineRoot, "data/ground-truth.json");
          fs.writeFileSync(target, JSON.stringify(json, null, 2) + "\n");
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: String(e) }));
        }
      });

      // Read endpoint for pipeline files
      server.middlewares.use("/pipeline", (req, res, next) => {
        const filePath = path.join(pipelineRoot, req.url ?? "");
        const resolved = path.resolve(filePath);
        // Security: only serve files under pipelineRoot
        if (resolved !== pipelineRoot && !resolved.startsWith(pipelineRoot + path.sep)) {
          res.statusCode = 403;
          res.end("Forbidden");
          return;
        }
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          res.setHeader(
            "Content-Type",
            resolved.endsWith(".json")
              ? "application/json"
              : resolved.endsWith(".jpg") || resolved.endsWith(".jpeg")
                ? "image/jpeg"
                : resolved.endsWith(".png")
                  ? "image/png"
                  : "application/octet-stream",
          );
          fs.createReadStream(resolved).pipe(res);
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), servePipelineFiles()],
  server: {
    fs: {
      allow: [pipelineRoot, path.resolve(__dirname, "../../..")],
    },
  },
});
