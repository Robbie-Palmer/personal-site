import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "@/lib/content/frontmatter";

describe("parseFrontmatter", () => {
  it("parses standard YAML front matter", () => {
    const { data, content } = parseFrontmatter(
      "---\ntitle: Soup\nservings: 4\ntags:\n  - quick\n  - vegan\n---\n@onion{1}",
    );
    expect(data).toEqual({
      title: "Soup",
      servings: 4,
      tags: ["quick", "vegan"],
    });
    expect(content.trim()).toBe("@onion{1}");
  });

  it("refuses to evaluate a `---js` JavaScript front-matter fence", () => {
    const flag = "__frontmatter_eval_marker__";
    const malicious = `---js\nmodule.exports = (() => { globalThis["${flag}"] = true; return {}; })()\n---\nbody`;

    expect(() => parseFrontmatter(malicious)).toThrow();
    expect((globalThis as Record<string, unknown>)[flag]).toBeUndefined();
  });

  it("refuses the `---javascript` alias as well", () => {
    expect(() =>
      parseFrontmatter("---javascript\nmodule.exports = {}\n---\nbody"),
    ).toThrow();
  });

  it("fails closed for every non-YAML/JSON fence (incl. case + unknown langs)", () => {
    // gray-matter only ships eval-free `yaml` and `json` engines plus the
    // eval-based `javascript` engine, which the helper overrides. Any other
    // language token resolves to an unregistered engine and throws, so there
    // is no `node`/`coffee`/arbitrary-fence bypass of the JS-engine block.
    for (const lang of ["JS", "Javascript", "node", "coffee", "cson", "wat"]) {
      expect(() => parseFrontmatter(`---${lang}\nx: 1\n---\nbody`)).toThrow();
    }
  });

  it("parses a `---json` fence without evaluating anything", () => {
    const { data } = parseFrontmatter('---json\n{ "title": "X" }\n---\nbody');
    expect(data).toEqual({ title: "X" });
  });

  it("still resolves ordinary YAML merge keys", () => {
    const { data } = parseFrontmatter(
      "---\ndefaults: &d\n  servings: 2\nmeal:\n  <<: *d\n  title: Soup\n---\nbody",
    );
    expect(data.meal).toEqual({ servings: 2, title: "Soup" });
  });
});
