import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("recipe web app manifest", () => {
  it("installs inside the recipe site with full-size and maskable icons", () => {
    const value = JSON.parse(
      readFileSync(
        path.resolve(__dirname, "../../../public/recipes/manifest.webmanifest"),
        "utf8",
      ),
    );

    expect(value).toMatchObject({
      display: "standalone",
      id: "/recipes",
      scope: "/recipes",
      start_url: "/recipes",
    });
    expect(value.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192", purpose: "any" }),
        expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
      ]),
    );
  });
});
