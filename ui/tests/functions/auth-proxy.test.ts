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

  it("returns undefined when CF_PAGES_HOST is absent", () => {
    expect(
      previewApiBase(
        new URL("https://pr-42.personal-site-bu5.pages.dev/api/auth/session"),
        { RECIPE_API_PREVIEW_ORIGIN_TEMPLATE: env.RECIPE_API_PREVIEW_ORIGIN_TEMPLATE },
      ),
    ).toBeUndefined();
  });

  it("returns undefined when RECIPE_API_PREVIEW_ORIGIN_TEMPLATE is absent", () => {
    expect(
      previewApiBase(
        new URL("https://pr-42.personal-site-bu5.pages.dev/api/auth/session"),
        { CF_PAGES_HOST: env.CF_PAGES_HOST },
      ),
    ).toBeUndefined();
  });

  it("returns undefined when both env vars are absent", () => {
    expect(
      previewApiBase(
        new URL("https://pr-42.personal-site-bu5.pages.dev/api/auth/session"),
        {},
      ),
    ).toBeUndefined();
  });

  it("returns undefined for a request to the Pages root host itself", () => {
    expect(
      previewApiBase(
        new URL("https://personal-site-bu5.pages.dev/api/auth/session"),
        env,
      ),
    ).toBeUndefined();
  });

  it("maps PR number 0 (pr-0) to its Worker origin", () => {
    expect(
      previewApiBase(
        new URL("https://pr-0.personal-site-bu5.pages.dev/api/auth/session"),
        env,
      ),
    ).toBe("https://recipe-api-pr-0.robbiepalmer95.workers.dev");
  });

  it("maps a large PR number correctly", () => {
    expect(
      previewApiBase(
        new URL("https://pr-9999.personal-site-bu5.pages.dev/api/auth/session"),
        env,
      ),
    ).toBe("https://recipe-api-pr-9999.robbiepalmer95.workers.dev");
  });

  it("is case-insensitive for the hostname comparison", () => {
    expect(
      previewApiBase(
        new URL("https://PR-42.PERSONAL-SITE-BU5.PAGES.DEV/api/auth/session"),
        env,
      ),
    ).toBe("https://recipe-api-pr-42.robbiepalmer95.workers.dev");
  });

  it("returns null when the template produces an HTTP (non-HTTPS) URL", () => {
    expect(
      previewApiBase(
        new URL("https://pr-42.personal-site-bu5.pages.dev/api/auth/session"),
        {
          ...env,
          RECIPE_API_PREVIEW_ORIGIN_TEMPLATE:
            "http://recipe-api-pr-{pr}.robbiepalmer95.workers.dev",
        },
      ),
    ).toBeNull();
  });

  it("returns null when the template produces an invalid URL", () => {
    expect(
      previewApiBase(
        new URL("https://pr-42.personal-site-bu5.pages.dev/api/auth/session"),
        {
          ...env,
          RECIPE_API_PREVIEW_ORIGIN_TEMPLATE: "not-a-valid-url-{pr}",
        },
      ),
    ).toBeNull();
  });

  it("strips the path from the template origin (returns only the origin)", () => {
    const origin = previewApiBase(
      new URL("https://pr-42.personal-site-bu5.pages.dev/api/auth/session"),
      env,
    );
    expect(origin).not.toContain("/api/");
    expect(origin).not.toMatch(/\/$/);
  });
});
