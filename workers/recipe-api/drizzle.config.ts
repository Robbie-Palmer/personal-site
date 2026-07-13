import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "../../packages/recipe-db/src/schema.ts",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url: process.env["DATABASE_URL"]!,
  },
});
