import fs from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";

const OUT_DIR = path.resolve(__dirname, "../../out");
const SITEMAP_PATH = path.join(OUT_DIR, "sitemap.xml");

// Subdomain projects that have their own routing and should not be in main sitemap
const SUBDOMAIN_PROJECTS = ["assettracker"];

describe("Sitemap Integration Test", () => {
  it("should have a sitemap.xml that includes all generated pages", () => {
    if (!fs.existsSync(SITEMAP_PATH)) {
      throw new Error("sitemap.xml not found. Ensure build has been run.");
    }
    const sitemapContent = fs.readFileSync(SITEMAP_PATH, "utf8");
    const urls = new Set<string>();
    const urlRegex = /<loc>(.*?)<\/loc>/g;
    let match = urlRegex.exec(sitemapContent);
    while (match !== null) {
      if (match[1]) {
        urls.add(match[1]);
      }
      match = urlRegex.exec(sitemapContent);
    }
    const htmlFiles = findAllHtmlFiles(OUT_DIR);
    const missingUrls: string[] = [];
    htmlFiles.forEach((file) => {
      let relativePath = path.relative(OUT_DIR, file);

      // Skip subdomain project paths
      const isSubdomainProject = SUBDOMAIN_PROJECTS.some(
        (project) =>
          relativePath.startsWith(`${project}/`) ||
          relativePath.startsWith(`${project}\\`) ||
          relativePath === `${project}.html`,
      );
      if (isSubdomainProject) {
        return;
      }

      if (relativePath.endsWith("index.html")) {
        relativePath = relativePath.replace("index.html", "");
      }
      if (relativePath.endsWith(".html")) {
        relativePath = relativePath.replace(".html", "");
      }
      if (relativePath.endsWith("/")) {
        relativePath = relativePath.slice(0, -1);
      }
      // Construct expected URL
      // Hardcoding site URL as it is in sitemap.ts
      const baseUrl = "https://robbiepalmer.me";
      const expectedUrl = relativePath ? `${baseUrl}/${relativePath}` : baseUrl;
      if (!urls.has(expectedUrl)) {
        missingUrls.push(`${file} -> ${expectedUrl}`);
      }
    });

    if (missingUrls.length > 0) {
      throw new Error(
        `Sitemap is missing URLs for the following generated files:\n${missingUrls.join("\n")}`,
      );
    }
  });
});

function findAllHtmlFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(findAllHtmlFiles(filePath));
    } else {
      if (file.endsWith(".html") && file !== "404.html") {
        results.push(filePath);
      }
    }
  }
  return results;
}
