import type { Db } from "recipe-db";
import { describe, expect, it } from "vitest";
import { RECIPE_AGENT_CAPABILITIES } from "../src/agent-auth";
import { createAuth } from "../src/auth";

describe("recipe Agent Auth capabilities", () => {
  it("keeps PostgreSQL secondary storage after applying Cloudflare options", () => {
    const auth = createAuth({} as Db, {
      BETTER_AUTH_URL: "https://recipes.example.test",
      BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
    });

    expect(auth.options.secondaryStorage).toBeDefined();
  });

  it("exposes only the first delegated read slice", () => {
    expect(
      RECIPE_AGENT_CAPABILITIES.map((capability) => capability.name),
    ).toEqual(["recipes.search", "recipes.read"]);
    expect(
      RECIPE_AGENT_CAPABILITIES.every(
        (capability) =>
          capability.approvalStrength === "session" &&
          capability.grantTTL === 30 * 24 * 60 * 60,
      ),
    ).toBe(true);
  });

  it("bounds recipe search input and result size", () => {
    const search = RECIPE_AGENT_CAPABILITIES.find(
      (capability) => capability.name === "recipes.search",
    );

    expect(search?.input).toMatchObject({
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: { minLength: 1, maxLength: 200 },
        limit: { minimum: 1, maximum: 25, default: 10 },
      },
    });
    expect(search?.output).toMatchObject({
      properties: { items: { maxItems: 25 } },
    });
  });
});
