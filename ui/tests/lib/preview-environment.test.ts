import { describe, expect, it } from "vitest";
import { isPreviewDeployment } from "@/lib/preview-environment";

describe("isPreviewDeployment", () => {
  it("recognizes canonical PR aliases", () => {
    expect(isPreviewDeployment("pr-42.personal-site-bu5.pages.dev")).toBe(true);
  });

  it.each([
    "robbiepalmer.me",
    "personal-site-bu5.pages.dev",
    "abc123.personal-site-bu5.pages.dev",
  ])("does not treat %s as a canonical PR alias", (hostname) => {
    expect(isPreviewDeployment(hostname)).toBe(false);
  });

  it("recognizes PR number 1", () => {
    expect(isPreviewDeployment("pr-1.myproject.pages.dev")).toBe(true);
  });

  it("recognizes PR number 0", () => {
    expect(isPreviewDeployment("pr-0.myproject.pages.dev")).toBe(true);
  });

  it("recognizes a large PR number", () => {
    expect(isPreviewDeployment("pr-9999.myproject.pages.dev")).toBe(true);
  });

  it("is case-insensitive for the pr- prefix", () => {
    expect(isPreviewDeployment("PR-42.myproject.pages.dev")).toBe(true);
  });

  it("does not recognize a hostname without the pages.dev suffix", () => {
    expect(isPreviewDeployment("pr-42.myproject.example.com")).toBe(false);
  });

  it("does not recognize localhost", () => {
    expect(isPreviewDeployment("localhost")).toBe(false);
  });

  it("does not recognize an IP address", () => {
    expect(isPreviewDeployment("127.0.0.1")).toBe(false);
  });

  it("does not recognize an empty string", () => {
    expect(isPreviewDeployment("")).toBe(false);
  });

  it("does not recognize a pages.dev subdomain that lacks a pr-N prefix", () => {
    expect(isPreviewDeployment("deploy-abc123.myproject.pages.dev")).toBe(false);
  });

  it("does not recognize a non-numeric pr alias like pr-abc", () => {
    expect(isPreviewDeployment("pr-abc.myproject.pages.dev")).toBe(false);
  });

  it("requires at least one character in the pages project segment", () => {
    // Regex requires `.+` between the PR alias and `pages.dev`
    expect(isPreviewDeployment("pr-42.pages.dev")).toBe(false);
  });
});
