import { describe, expect, it } from "vitest";
import { getTechIconKey } from "@/lib/api/tech-icons";

describe("technology icons", () => {
  it("resolves the reveal.js logo from Simple Icons", () => {
    expect(getTechIconKey("reveal.js")).toBe("simple:revealdotjs");
  });

  it("resolves the K3s logo from Simple Icons", () => {
    expect(getTechIconKey("K3s")).toBe("simple:k3s");
  });
});
