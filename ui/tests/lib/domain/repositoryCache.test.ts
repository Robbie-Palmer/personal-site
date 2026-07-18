import { describe, expect, it } from "vitest";
import {
  loadDomainRepository,
  resetDomainRepositoryCache,
} from "@/lib/repository";

describe("domain repository cache", () => {
  it("returns the same instance across calls", () => {
    resetDomainRepositoryCache();
    const first = loadDomainRepository();

    expect(loadDomainRepository()).toBe(first);
  });

  it("rebuilds after an explicit reset", () => {
    resetDomainRepositoryCache();
    const first = loadDomainRepository();
    resetDomainRepositoryCache();
    const rebuilt = loadDomainRepository();

    expect(rebuilt).not.toBe(first);
    expect(rebuilt.technologies.size).toBe(first.technologies.size);
    expect(rebuilt.projects.size).toBe(first.projects.size);
  });
});
