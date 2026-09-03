import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getTechIconKey, TechIcon } from "@/lib/api/tech-icons";

describe("technology icons", () => {
  it("resolves the reveal.js logo from Simple Icons", () => {
    expect(getTechIconKey("reveal.js")).toBe("simple:revealdotjs");
  });

  it("resolves the K3s logo from Simple Icons", () => {
    expect(getTechIconKey("K3s")).toBe("simple:k3s");
  });

  it("preserves the full-color t3-code logo", () => {
    expect(getTechIconKey("t3-code")).toBe("custom:t3code");

    const markup = renderToStaticMarkup(TechIcon({ name: "t3-code" }));

    expect(markup).not.toContain("brightness-0");
    expect(markup).not.toContain("dark:invert");
  });
});
