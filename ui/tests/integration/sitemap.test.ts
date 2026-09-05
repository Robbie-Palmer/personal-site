import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const OUT_DIR = path.resolve(__dirname, "../../out");
const SITEMAP_PATH = path.join(OUT_DIR, "sitemap.xml");
const SITE_URL = "https://robbiepalmer.me";

// Subdomain projects that have their own routing and should not be in main sitemap
const SUBDOMAIN_PROJECTS = new Set(["assettracker"]);

// Static, non-page HTML artifacts served from /public (e.g. the embedded recipe
// design prototype) — versioned and served, but not navigable pages, so they
// are intentionally excluded from the sitemap.
const STATIC_ASSET_SEGMENTS = new Set(["recipe-site-design"]);

// Compatibility and interactive app pages marked noindex — served but kept
// out of the sitemap on purpose.
const NOINDEX_PAGES = new Set([
  "initiatives",
  "recipes/add",
  "recipes/cooks",
  "recipes/discover",
  "recipes/edit",
  "recipes/kitchen",
  "recipes/log",
  "recipes/notifications",
  "recipes/onboarding",
  "recipes/profile",
  "recipes/saved",
  "recipes/settings",
  "recipes/settings/agents/approve",
  "recipes/shopping",
]);

describe("Sitemap Integration Test", () => {
  it("should have a sitemap.xml that includes all generated pages", () => {
    expect(
      fs.existsSync(SITEMAP_PATH),
      "sitemap.xml not found. Ensure build has been run.",
    ).toBe(true);
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
      // Normalize path separators to forward slashes
      const normalizedPath = relativePath.replace(/\\/g, "/");

      // Skip subdomain project paths
      const topLevelSegment = normalizedPath.split("/")[0];
      const fileNameWithoutExt = normalizedPath.replace(/\.html$/, "");
      const isSubdomainProject =
        (topLevelSegment && SUBDOMAIN_PROJECTS.has(topLevelSegment)) ||
        SUBDOMAIN_PROJECTS.has(fileNameWithoutExt);
      if (isSubdomainProject) {
        return;
      }
      if (topLevelSegment && STATIC_ASSET_SEGMENTS.has(topLevelSegment)) {
        return;
      }
      if (NOINDEX_PAGES.has(fileNameWithoutExt)) {
        return;
      }
      if (fileNameWithoutExt.endsWith("/deck/presenter")) {
        return;
      }

      relativePath = normalizedPath;

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
      const expectedUrl = relativePath
        ? `${SITE_URL}/${relativePath}`
        : SITE_URL;
      if (!urls.has(expectedUrl)) {
        missingUrls.push(`${file} -> ${expectedUrl}`);
      }
    });

    expect(missingUrls).toEqual([]);
    expect(urls).not.toContain(`${SITE_URL}/initiatives`);
    expect(
      [...urls].some((url) => url.startsWith(`${SITE_URL}/initiatives/`)),
    ).toBe(true);
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
