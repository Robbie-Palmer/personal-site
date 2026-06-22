import { describe, expect, it } from "vitest";
import { previewApiBase } from "../../../functions/api/auth/routing";

const env = {
  CF_PAGES_HOST: "personal-site-bu5.pages.dev",
  RECIPE_API_PREVIEW_ORIGIN_TEMPLATE:
    "https://recipe-api-pr-{pr}.robbiepalmer95.workers.dev",
};

describe("preview auth proxy routing", () => {
  it("maps the canonical PR alias to its isolated Worker", () => {
    expect(
      previewApiBase(
        new URL("https://pr-42.personal-site-bu5.pages.dev/api/auth/session"),
        env,
      ),
    ).toBe("https://recipe-api-pr-42.robbiepalmer95.workers.dev");
  });

  it("rejects non-canonical Pages preview aliases", () => {
    expect(
      previewApiBase(
        new URL("https://abc123.personal-site-bu5.pages.dev/api/auth/session"),
        env,
      ),
    ).toBeNull();
  });

  it("leaves production and custom domains on the production route", () => {
    expect(
      previewApiBase(new URL("https://robbiepalmer.me/api/auth/session"), env),
    ).toBeUndefined();
  });
});
