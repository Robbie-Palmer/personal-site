import { describe, it, expect } from "vitest";
import {
  previewScenarios,
  findPreviewScenario,
} from "../src/preview-scenarios";

describe("previewScenarios", () => {
  it("exports exactly three scenarios", () => {
    expect(previewScenarios).toHaveLength(3);
  });

  it("includes the empty-user scenario", () => {
    const scenario = previewScenarios.find((s) => s.id === "empty-user");
    expect(scenario).toBeDefined();
    expect(scenario?.name).toBe("Empty account");
    expect(scenario?.email).toBe("empty-user@preview.invalid");
    expect(scenario?.role).toBe("user");
  });

  it("includes the user-with-recipes scenario", () => {
    const scenario = previewScenarios.find((s) => s.id === "user-with-recipes");
    expect(scenario).toBeDefined();
    expect(scenario?.name).toBe("User with recipes");
    expect(scenario?.email).toBe("recipes-user@preview.invalid");
    expect(scenario?.role).toBe("user");
  });

  it("includes the admin-user scenario", () => {
    const scenario = previewScenarios.find((s) => s.id === "admin-user");
    expect(scenario).toBeDefined();
    expect(scenario?.name).toBe("Administrator");
    expect(scenario?.email).toBe("admin-user@preview.invalid");
    expect(scenario?.role).toBe("admin");
  });

  it("uses @preview.invalid for all email addresses", () => {
    for (const scenario of previewScenarios) {
      expect(scenario.email).toMatch(/@preview\.invalid$/);
    }
  });

  it("gives each scenario a unique id", () => {
    const ids = previewScenarios.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(previewScenarios.length);
  });

  it("gives each scenario a unique email", () => {
    const emails = previewScenarios.map((s) => s.email);
    const uniqueEmails = new Set(emails);
    expect(uniqueEmails.size).toBe(previewScenarios.length);
  });

  it("includes a non-empty description for every scenario", () => {
    for (const scenario of previewScenarios) {
      expect(scenario.description.length).toBeGreaterThan(0);
    }
  });
});

describe("findPreviewScenario", () => {
  it("returns the correct scenario for each known id", () => {
    for (const scenario of previewScenarios) {
      expect(findPreviewScenario(scenario.id)).toBe(scenario);
    }
  });

  it("returns undefined for an unknown string id", () => {
    expect(findPreviewScenario("unknown-scenario")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(findPreviewScenario("")).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(findPreviewScenario(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(findPreviewScenario(undefined)).toBeUndefined();
  });

  it("returns undefined for a number", () => {
    expect(findPreviewScenario(42)).toBeUndefined();
  });

  it("returns undefined for an object", () => {
    expect(findPreviewScenario({ id: "empty-user" })).toBeUndefined();
  });

  it("returns undefined for an array", () => {
    expect(findPreviewScenario(["empty-user"])).toBeUndefined();
  });

  it("is case-sensitive and rejects ids with different casing", () => {
    expect(findPreviewScenario("Empty-User")).toBeUndefined();
    expect(findPreviewScenario("EMPTY-USER")).toBeUndefined();
    expect(findPreviewScenario("Admin-User")).toBeUndefined();
  });

  it("returns undefined for a partial match", () => {
    expect(findPreviewScenario("empty")).toBeUndefined();
    expect(findPreviewScenario("user")).toBeUndefined();
  });
});